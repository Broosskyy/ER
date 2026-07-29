import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { EventConflictRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import { detectConflictingValues } from '@/features/aggregation/merge/event-conflict';
import { applyEventPublishLifecycle } from '@/features/import/services/event-publish-lifecycle';
import type { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import {
  publishLifecycleDomainEvent,
  type RealDataDomainEventBus,
} from '@/features/events/domain/real-data-domain-events';
import type { EventLifecycleEvaluation } from '../domain/lifecycle-engine-types';
import { EventLifecycleEngine } from './event-lifecycle-engine';

export class EventLifecycleOrchestrator {
  constructor(
    private readonly lifecycleEngine: EventLifecycleEngine,
    private readonly domainEventBus?: RealDataDomainEventBus,
    private readonly reviewQueueService?: ImportReviewQueueService,
    private readonly conflictRepository?: EventConflictRepository,
  ) {}

  async processImportPublish(input: {
    before?: AdminEventRecord | null;
    after: AdminEventRecord;
    candidate: CanonicalImportEvent;
    source: SourceRecord;
    record?: ImportRecord;
    cancelled?: boolean;
    postponed?: boolean;
  }): Promise<AdminEventRecord> {
    const lifecycleStamped = applyEventPublishLifecycle(input.after, {
      existing: input.before,
      normalizedPayload: input.record?.normalizedPayload as Record<string, unknown> | undefined,
    });

    const result = await this.lifecycleEngine.process({
      before: input.before,
      after: lifecycleStamped,
      candidate: input.candidate,
      context: {
        sourceId: input.source.id,
        sourceName: input.source.displayName,
        importJobId: input.record?.importJobId,
        importRecordId: input.record?.id,
        trustScore: input.source.computedTrustScore ?? input.source.trustScore,
        cancelled: input.cancelled,
        postponed: input.postponed,
      },
    });

    for (const evaluation of result.evaluations) {
      await this.persistSideEffects(
        evaluation,
        input.record,
        input.source,
        result.queuedForReview,
        input.before,
      );
      this.emitDomainEvent(evaluation, input.source.id);
    }

    return result.event;
  }

  async processArchive(input: {
    before: AdminEventRecord;
    source: SourceRecord;
    importJobId?: string;
    importRecordId?: string;
  }): Promise<AdminEventRecord> {
    const after: AdminEventRecord = {
      ...input.before,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    };

    const result = await this.lifecycleEngine.process({
      before: input.before,
      after,
      context: {
        sourceId: input.source.id,
        importJobId: input.importJobId,
        importRecordId: input.importRecordId,
        trustScore: input.source.trustScore,
      },
    });

    for (const evaluation of result.evaluations) {
      await this.persistSideEffects(evaluation, undefined, input.source, result.queuedForReview);
      this.emitDomainEvent(evaluation, input.source.id);
    }

    return result.event;
  }

  private async persistSideEffects(
    evaluation: EventLifecycleEvaluation,
    record: ImportRecord | undefined,
    source: SourceRecord,
    queuedForReview: boolean,
    existingEvent?: AdminEventRecord | null,
  ): Promise<void> {
    if (evaluation.decision === 'create_conflict' && this.conflictRepository) {
      for (const change of evaluation.changes) {
        const conflict = detectConflictingValues(
          evaluation.canonicalEventId,
          change.fieldPath,
          [
            { sourceId: source.id, value: change.newValue },
            { sourceId: 'canonical', value: change.oldValue },
          ],
          change.severity === 'critical' ? 'critical' : change.severity === 'warning' ? 'warning' : 'info',
          evaluation.createdAt,
        );
        if (conflict) {
          await this.conflictRepository.create(conflict);
        }
      }
    }

    if (queuedForReview && record && this.reviewQueueService) {
      await this.reviewQueueService.enqueueFromLifecycleEvaluation(
        record,
        source,
        evaluation,
        record.importJobId,
        existingEvent,
      );
    }
  }

  private emitDomainEvent(evaluation: EventLifecycleEvaluation, sourceId: string): void {
    if (!this.domainEventBus || evaluation.decision === 'ignore') {
      return;
    }

    const typeMap: Partial<Record<string, Parameters<typeof publishLifecycleDomainEvent>[1]['type']>> = {
      event_created: 'event_created',
      event_updated: 'event_updated',
      event_cancelled: 'event_cancelled',
      event_postponed: 'event_postponed',
      lineup_changed: 'lineup_changed',
    };

    const domainType = typeMap[evaluation.lifecycleEventType] ?? 'event_updated';
    publishLifecycleDomainEvent(this.domainEventBus, {
      type: domainType,
      canonicalEventId: evaluation.canonicalEventId,
      sourceId,
      payload: {
        decision: evaluation.decision,
        changes: evaluation.changes.map((change) => ({
          field: change.fieldPath,
          oldValue: change.oldValue,
          newValue: change.newValue,
        })),
      },
      occurredAt: evaluation.createdAt,
    });
  }
}
