import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { blockingKeyDuplicateCandidateGenerator } from '@/features/aggregation/duplicate/duplicate-candidate-generator';
import type { DuplicateDecisionService } from '@/features/aggregation/services/duplicate-decision-service';
import type { EventConflictRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import { detectConflictingValues } from '@/features/aggregation/merge/event-conflict';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import type {
  EventBlockingKeyRepository,
  EventMatchEvaluationRepository,
  EventMergeCandidateRepository,
  MultiSourceMatchEvaluation,
} from '../domain/matching-types';
import { MultiSourceMatchEngine } from './multi-source-match-engine';

function createMergeCandidateId(): string {
  return `merge-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class MultiSourceMatchOrchestrator {
  constructor(
    private readonly matchEngine: MultiSourceMatchEngine,
    private readonly evaluationRepository: EventMatchEvaluationRepository,
    private readonly mergeCandidateRepository: EventMergeCandidateRepository,
    private readonly blockingKeyRepository: EventBlockingKeyRepository,
    private readonly recordRepository: ImportRecordRepository,
    private readonly reviewQueueService?: ImportReviewQueueService,
    private readonly duplicateDecisionService?: DuplicateDecisionService,
    private readonly conflictRepository?: EventConflictRepository,
  ) {}

  async processRecord(
    record: ImportRecord,
    source: SourceRecord,
    catalog: MatchingCatalog,
    jobId?: string,
    existingEvent?: AdminEventRecord | null,
  ): Promise<MultiSourceMatchEvaluation> {
    const candidate = getEffectiveCandidate(record);
    const incoming: CanonicalImportEvent = {
      ...candidate,
      sourceId: record.sourceId,
      sourceName: record.sourceName ?? source.displayName,
      externalId: record.externalId,
    };

    const evaluation = await this.matchEngine.evaluate({
      incoming,
      sourceId: record.sourceId,
      externalEventId: record.externalId,
      importRecordId: record.id,
      importJobId: jobId ?? record.importJobId,
      catalog,
      context: {
        matchedVenueId: record.matchedVenueId,
        matchedArtistIds: record.matchedArtistIds,
        importDuplicateScore: record.duplicateScore,
        importDuplicateEventId: record.duplicateEventId,
      },
    });

    await this.evaluationRepository.create(evaluation);
    await this.applyEvaluation(record, source, evaluation, existingEvent, jobId);

    return evaluation;
  }

  async indexPublishedEvent(canonicalEventId: string, event: CanonicalImportEvent): Promise<void> {
    const candidate = blockingKeyDuplicateCandidateGenerator.createCandidate(canonicalEventId, event);
    await this.blockingKeyRepository.indexKeys(canonicalEventId, candidate.blockingKeys);
  }

  private async applyEvaluation(
    record: ImportRecord,
    source: SourceRecord,
    evaluation: MultiSourceMatchEvaluation,
    existingEvent?: AdminEventRecord | null,
    jobId?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatedRecord: ImportRecord = {
      ...record,
      duplicateEventId: evaluation.canonicalEventId ?? record.duplicateEventId,
      duplicateScore: Math.max(record.duplicateScore ?? 0, evaluation.confidenceScore),
      matchEvaluationId: evaluation.id,
      updatedAt: now,
    };
    await this.recordRepository.update(updatedRecord);

    if (evaluation.canonicalEventId) {
      await this.mergeCandidateRepository.upsert({
        id: createMergeCandidateId(),
        evaluationId: evaluation.id,
        canonicalEventId: evaluation.canonicalEventId,
        sourceId: record.sourceId,
        externalEventId: record.externalId,
        confidenceScore: evaluation.confidenceScore,
        status: evaluation.decision === 'auto_link' ? 'approved' : 'pending',
        metadata: {
          decision: evaluation.decision,
          confidenceTier: evaluation.confidenceTier,
          reasons: evaluation.reasons,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    if (evaluation.fieldDifferences.length > 0 && evaluation.canonicalEventId && this.conflictRepository) {
      for (const difference of evaluation.fieldDifferences) {
        const conflict = detectConflictingValues(
          evaluation.canonicalEventId,
          difference.field,
          [
            { sourceId: record.sourceId, value: difference.incomingValue },
            { sourceId: 'canonical', value: difference.canonicalValue },
          ],
          difference.severity === 'critical' ? 'critical' : difference.severity === 'warning' ? 'warning' : 'info',
          now,
        );
        if (conflict) {
          await this.conflictRepository.create(conflict);
        }
      }
    }

    if (evaluation.decision === 'review_required' && this.reviewQueueService) {
      await this.reviewQueueService.enqueueFromMatchEvaluation(
        updatedRecord,
        source,
        evaluation,
        jobId ?? record.importJobId,
        existingEvent,
      );
    }

    if (evaluation.decision === 'keep_separate' && evaluation.confidenceScore >= 50 && this.duplicateDecisionService) {
      await this.duplicateDecisionService.decide({
        id: `dup-decision-${evaluation.id}`,
        candidateIds: [record.id, evaluation.canonicalEventId ?? record.externalId],
        sourceIds: evaluation.involvedSourceIds,
        canonicalEventId: evaluation.canonicalEventId,
        decision: 'kept_separate',
        reason: evaluation.reasons.join(' '),
        decidedAt: now,
        confidence: evaluation.confidenceScore,
        fingerprintSnapshot: evaluation.fingerprintSnapshot,
        reversible: true,
      });
    }
  }
}
