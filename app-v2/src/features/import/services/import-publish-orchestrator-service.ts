import type { SourceRecord } from '@/data/types/records';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import type { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import type { ImportLoggingService } from '@/features/import/services/import-logging-service';
import type { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import type { SourceReputationService } from '@/features/trust-quality/services/source-reputation-service';
import type { MultiSourceMatchOrchestrator } from '@/features/multi-source-matching/services/multi-source-match-orchestrator';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import {
  detectSemanticChangeSet,
  isStablePublishedTrustReimport,
  recordHasLinkedPublishedEvent,
  recordHasPublishedOutcome,
} from '@/features/import/services/published-reimport-reconciliation';

export interface ImportPublishBatchResult {
  publishedCount: number;
  queuedCount: number;
  skippedCount: number;
  rejectedCount: number;
  heldCount: number;
}

export class ImportPublishOrchestratorService {
  constructor(
    private readonly recordRepository: ImportRecordRepository,
    private readonly publishService: ImportEventPublishService,
    private readonly publishDecision: PublishDecisionService,
    private readonly loggingService?: ImportLoggingService,
    private readonly reviewQueueService?: ImportReviewQueueService,
    private readonly reputationService?: SourceReputationService,
    private readonly matchOrchestrator?: MultiSourceMatchOrchestrator,
    private readonly adminEventRepository?: AdminEventRepository,
  ) {}

  async processJobRecords(
    jobId: string,
    source: SourceRecord,
    previousRecords: ImportRecord[],
    actorId?: string,
  ): Promise<ImportPublishBatchResult> {
    const records = await this.recordRepository.listByJobId(jobId);
    let publishedCount = 0;
    let queuedCount = 0;
    let skippedCount = 0;
    let rejectedCount = 0;
    let heldCount = 0;
    let currentSource = source;

    for (const record of records) {
      const existingEvent =
        this.adminEventRepository && record.resultingEventId
          ? await this.adminEventRepository.getById(record.resultingEventId)
          : null;
      const evaluation = await this.publishDecision.evaluate({ source: currentSource, record });
      const changeSet = detectSemanticChangeSet(record, existingEvent);
      const stablePublishedReimport =
        recordHasLinkedPublishedEvent(record) &&
        existingEvent?.status === 'published' &&
        changeSet.changeType === 'unchanged' &&
        evaluation != null &&
        isStablePublishedTrustReimport(record, evaluation, { existingEvent });

      if (stablePublishedReimport && this.reviewQueueService) {
        await this.reviewQueueService.reconcileStablePublishedReimport(
          record,
          currentSource,
          evaluation,
          existingEvent,
          jobId,
        );
        skippedCount += 1;
        if (record.status !== 'imported' && record.resultingEventId) {
          await this.recordRepository.update({
            ...record,
            status: 'imported',
            updatedAt: new Date().toISOString(),
          });
        }
        continue;
      }

      const decision = evaluation
        ? this.publishDecision.mapTrustDecision(evaluation.decision)
        : await this.publishDecision.decide({ source: currentSource, record });

      if (evaluation && this.reviewQueueService && evaluation.decision !== 'reject') {
        await this.reviewQueueService.reconcileFromEvaluation(
          record,
          currentSource,
          evaluation,
          jobId,
          existingEvent,
        );
        if (evaluation.decision === 'hold') {
          heldCount += 1;
        }
      }

      if (decision === 'skip') {
        skippedCount += 1;
        const publishedOutcome = recordHasPublishedOutcome(record, existingEvent);
        const hasPublishedUpdate =
          publishedOutcome &&
          existingEvent?.status === 'published' &&
          changeSet.changeType === 'updated';

        if (hasPublishedUpdate) {
          const updateResult = await this.tryPublishPublishedUpdate({
            record,
            source: currentSource,
            previousRecords,
            evaluation,
            jobId,
            actorId: actorId ?? 'system:auto-publish',
          });
          publishedCount += updateResult.publishedCount;
          queuedCount += updateResult.queuedCount;
          currentSource = updateResult.source;
          continue;
        }

        if (evaluation?.decision === 'reject' && record.status !== 'rejected' && !publishedOutcome) {
          rejectedCount += 1;
          await this.recordRepository.update({
            ...record,
            status: 'rejected',
            updatedAt: new Date().toISOString(),
          });
        }
        if (evaluation && this.reputationService) {
          currentSource = await this.reputationService.recordPublishDecision(
            currentSource,
            evaluation.decision,
            { importRecordId: record.id, jobId },
          );
        }
        continue;
      }

      if (decision === 'queue_for_review') {
        const publishedOutcome = recordHasPublishedOutcome(record, existingEvent);
        const hasPublishedUpdate =
          publishedOutcome &&
          existingEvent?.status === 'published' &&
          changeSet.changeType === 'updated';

        if (
          evaluation &&
          this.reviewQueueService &&
          isStablePublishedTrustReimport(record, evaluation, { existingEvent })
        ) {
          await this.reviewQueueService.reconcileStablePublishedReimport(
            record,
            currentSource,
            evaluation,
            existingEvent,
            jobId,
          );
          skippedCount += 1;
          if (record.status !== 'imported' && record.resultingEventId) {
            await this.recordRepository.update({
              ...record,
              status: 'imported',
              updatedAt: new Date().toISOString(),
            });
          }
          continue;
        }

        if (hasPublishedUpdate) {
          const updateResult = await this.tryPublishPublishedUpdate({
            record,
            source: currentSource,
            previousRecords,
            evaluation,
            jobId,
            actorId: actorId ?? 'system:auto-publish',
          });
          publishedCount += updateResult.publishedCount;
          queuedCount += updateResult.queuedCount;
          currentSource = updateResult.source;
          continue;
        }

        if (record.status !== 'needs_review') {
          await this.recordRepository.update({
            ...record,
            status: 'needs_review',
            updatedAt: new Date().toISOString(),
          });
        }
        queuedCount += 1;
        if (evaluation && this.reputationService) {
          currentSource = await this.reputationService.recordPublishDecision(
            currentSource,
            evaluation.decision,
            { importRecordId: record.id, jobId },
          );
        }
        continue;
      }

      try {
        const publishResult = await this.publishService.publishRecord(record, currentSource, previousRecords, {
          actorId: actorId ?? 'system:auto-publish',
        });
        publishedCount += 1;
        if (evaluation && this.reputationService) {
          currentSource = await this.reputationService.recordPublishDecision(
            currentSource,
            evaluation.decision,
            { importRecordId: record.id, jobId },
          );
        }
        await this.loggingService?.info(
          jobId,
          'IMPORT_AUTO_PUBLISHED',
          `Auto-published record ${record.externalId} from ${currentSource.displayName}.`,
          record.id,
        );
        if (this.matchOrchestrator) {
          const candidate = getEffectiveCandidate(record);
          await this.matchOrchestrator.indexPublishedEvent(
            publishResult.event.canonicalEventId ?? publishResult.event.id,
            {
              ...candidate,
              sourceId: record.sourceId,
              sourceName: record.sourceName ?? currentSource.displayName,
              externalId: record.externalId,
            },
          );
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Auto-publish failed.';
        await this.recordRepository.update({
          ...record,
          status: 'needs_review',
          updatedAt: new Date().toISOString(),
        });
        queuedCount += 1;
        if (this.reviewQueueService) {
          await this.reviewQueueService.reconcilePublishFailure(
            record,
            currentSource,
            evaluation ?? null,
            message,
            jobId,
          );
        }
        if (this.reputationService) {
          currentSource = await this.reputationService.recordPublishDecision(
            currentSource,
            'review_required',
            { importRecordId: record.id, jobId, error: message },
          );
        }
        await this.loggingService?.warning(
          jobId,
          'IMPORT_AUTO_PUBLISH_FAILED',
          `${record.externalId}: ${message}`,
          record.id,
        );
      }
    }

    if (publishedCount > 0) {
      await this.publishService.refreshConsumerFeed();
    }

    return { publishedCount, queuedCount, skippedCount, rejectedCount, heldCount };
  }

  private async tryPublishPublishedUpdate(input: {
    record: ImportRecord;
    source: SourceRecord;
    previousRecords: ImportRecord[];
    evaluation: Awaited<ReturnType<PublishDecisionService['evaluate']>>;
    jobId: string;
    actorId: string;
    logPrefix?: string;
  }): Promise<{ publishedCount: number; queuedCount: number; source: SourceRecord }> {
    let source = input.source;
    try {
      const publishResult = await this.publishService.publishRecord(
        input.record,
        source,
        input.previousRecords,
        {
          actorId: input.actorId,
        },
      );
      if (input.record.status !== 'imported') {
        await this.recordRepository.update({
          ...input.record,
          status: 'imported',
          resultingEventId:
            input.record.resultingEventId ??
            publishResult.event.id ??
            publishResult.event.canonicalEventId,
          updatedAt: new Date().toISOString(),
        });
      }
      if (input.evaluation && this.reputationService) {
        source = await this.reputationService.recordPublishDecision(
          source,
          input.evaluation.decision === 'reject' ? 'auto_publish' : input.evaluation.decision,
          { importRecordId: input.record.id, jobId: input.jobId, publishedUpdate: true },
        );
      }
      await this.loggingService?.info(
        input.jobId,
        'IMPORT_AUTO_PUBLISHED',
        `${input.logPrefix ?? 'Updated published record'} ${input.record.externalId} from ${source.displayName}.`,
        input.record.id,
      );
      if (this.matchOrchestrator) {
        const candidate = getEffectiveCandidate(input.record);
        await this.matchOrchestrator.indexPublishedEvent(
          publishResult.event.canonicalEventId ?? publishResult.event.id,
          {
            ...candidate,
            sourceId: input.record.sourceId,
            sourceName: input.record.sourceName ?? source.displayName,
            externalId: input.record.externalId,
          },
        );
      }
      return { publishedCount: 1, queuedCount: 0, source };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Auto-publish failed.';
      await this.recordRepository.update({
        ...input.record,
        status: 'needs_review',
        updatedAt: new Date().toISOString(),
      });
      if (this.reviewQueueService) {
        await this.reviewQueueService.reconcilePublishFailure(
          input.record,
          source,
          input.evaluation ?? null,
          message,
          input.jobId,
        );
      }
      if (this.reputationService) {
        source = await this.reputationService.recordPublishDecision(
          source,
          'review_required',
          { importRecordId: input.record.id, jobId: input.jobId, error: message },
        );
      }
      await this.loggingService?.warning(
        input.jobId,
        'IMPORT_AUTO_PUBLISH_FAILED',
        `${input.record.externalId}: ${message}`,
        input.record.id,
      );
      return { publishedCount: 0, queuedCount: 1, source };
    }
  }

  async reevaluateRecords(
    records: ImportRecord[],
    loadSource: () => Promise<SourceRecord>,
    previousRecords: ImportRecord[],
    options: { actorId?: string; jobId?: string } = {},
  ): Promise<ImportPublishBatchResult> {
    let publishedCount = 0;
    let queuedCount = 0;
    let skippedCount = 0;
    let rejectedCount = 0;
    let heldCount = 0;

    for (const record of records) {
      const currentSource = await loadSource();
      const existingEvent =
        this.adminEventRepository && record.resultingEventId
          ? await this.adminEventRepository.getById(record.resultingEventId)
          : null;
      const evaluation = await this.publishDecision.evaluate({ source: currentSource, record });
      const changeSet = detectSemanticChangeSet(record, existingEvent);
      const stablePublishedReimport =
        recordHasLinkedPublishedEvent(record) &&
        existingEvent?.status === 'published' &&
        changeSet.changeType === 'unchanged' &&
        evaluation != null &&
        isStablePublishedTrustReimport(record, evaluation, { existingEvent });

      if (stablePublishedReimport && this.reviewQueueService) {
        await this.reviewQueueService.reconcileStablePublishedReimport(
          record,
          currentSource,
          evaluation,
          existingEvent,
          options.jobId,
        );
        skippedCount += 1;
        continue;
      }

      const decision = evaluation
        ? this.publishDecision.mapTrustDecision(evaluation.decision)
        : await this.publishDecision.decide({ source: currentSource, record });

      if (evaluation && this.reviewQueueService && evaluation.decision !== 'reject') {
        await this.reviewQueueService.reconcileFromEvaluation(
          record,
          currentSource,
          evaluation,
          options.jobId,
          existingEvent,
        );
        if (evaluation.decision === 'hold') {
          heldCount += 1;
        }
      }

      if (decision === 'skip') {
        skippedCount += 1;
        if (evaluation?.decision === 'reject' && record.status !== 'rejected') {
          rejectedCount += 1;
          await this.recordRepository.update({
            ...record,
            status: 'rejected',
            updatedAt: new Date().toISOString(),
          });
        }
        if (evaluation && this.reputationService) {
          await this.reputationService.recordPublishDecision(
            currentSource,
            evaluation.decision,
            { importRecordId: record.id, jobId: options.jobId, reevaluation: true },
          );
        }
        continue;
      }

      if (decision === 'queue_for_review') {
        if (record.status !== 'needs_review') {
          await this.recordRepository.update({
            ...record,
            status: 'needs_review',
            updatedAt: new Date().toISOString(),
          });
        }
        queuedCount += 1;
        if (evaluation && this.reputationService) {
          await this.reputationService.recordPublishDecision(
            currentSource,
            evaluation.decision,
            { importRecordId: record.id, jobId: options.jobId, reevaluation: true },
          );
        }
        continue;
      }

      try {
        const publishResult = await this.publishService.publishRecord(
          record,
          currentSource,
          previousRecords,
          {
            actorId: options.actorId ?? 'system:trust-reevaluation',
          },
        );
        publishedCount += 1;
        if (evaluation && this.reputationService) {
          await this.reputationService.recordPublishDecision(
            currentSource,
            evaluation.decision,
            { importRecordId: record.id, jobId: options.jobId, reevaluation: true },
          );
        }
        await this.loggingService?.info(
          options.jobId ?? record.importJobId,
          'IMPORT_AUTO_PUBLISHED',
          `Re-evaluation auto-published record ${record.externalId} from ${currentSource.displayName}.`,
          record.id,
        );
        if (this.matchOrchestrator) {
          const candidate = getEffectiveCandidate(record);
          await this.matchOrchestrator.indexPublishedEvent(
            publishResult.event.canonicalEventId ?? publishResult.event.id,
            {
              ...candidate,
              sourceId: record.sourceId,
              sourceName: record.sourceName ?? currentSource.displayName,
              externalId: record.externalId,
            },
          );
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Auto-publish failed.';
        await this.recordRepository.update({
          ...record,
          status: 'needs_review',
          updatedAt: new Date().toISOString(),
        });
        queuedCount += 1;
        if (this.reviewQueueService) {
          await this.reviewQueueService.reconcilePublishFailure(
            record,
            currentSource,
            evaluation ?? null,
            message,
            options.jobId,
          );
        }
        if (this.reputationService) {
          await this.reputationService.recordPublishDecision(
            currentSource,
            'review_required',
            { importRecordId: record.id, jobId: options.jobId, error: message, reevaluation: true },
          );
        }
        await this.loggingService?.warning(
          options.jobId ?? record.importJobId,
          'IMPORT_AUTO_PUBLISH_FAILED',
          `${record.externalId}: ${message}`,
          record.id,
        );
      }
    }

    if (publishedCount > 0) {
      await this.publishService.refreshConsumerFeed();
    }

    return { publishedCount, queuedCount, skippedCount, rejectedCount, heldCount };
  }
}
