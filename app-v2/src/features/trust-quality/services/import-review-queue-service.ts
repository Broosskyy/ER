import type { TrustPublishEvaluation } from '../domain/trust-quality-types';

import type { ImportReviewQueueRepository } from '../domain/trust-quality-types';

import {

  IMPORT_REVIEW_RESOLUTION_REASONS,

  type ImportReviewQueueEntry,

  type ImportReviewReconcileResult,

} from '../domain/trust-quality-types';

import type { EventLifecycleEvaluation } from '@/features/event-lifecycle/domain/lifecycle-engine-types';

import type { MultiSourceMatchEvaluation } from '@/features/multi-source-matching/domain/matching-types';

import type { ImportRecord } from '@/features/import/models/types';

import type { SourceRecord } from '@/data/types/records';

import type { AdminEventRecord } from '@/data/types/records';

import {

  isStablePublishedLifecycleReimport,

  isStablePublishedMatchReimport,

  isStablePublishedTrustReimport,

  recordHasPublishedOutcome,

} from '@/features/import/services/published-reimport-reconciliation';



function createReviewQueueId(): string {

  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



function buildReviewMetadata(

  evaluation: TrustPublishEvaluation,

  source: SourceRecord,

  existing?: Record<string, unknown>,

): Record<string, unknown> {

  return {

    ...(existing ?? {}),

    qualityTier: evaluation.quality.tier,

    sourceName: source.displayName,

    lastEvaluatedAt: new Date().toISOString(),

    lastEvaluationDecision: evaluation.decision,

  };

}



function isStaleRepublishTrustReview(

  record: ImportRecord,

  evaluation: TrustPublishEvaluation,

  existingEvent?: AdminEventRecord | null,

): boolean {

  return isStablePublishedTrustReimport(record, evaluation, { existingEvent });

}



async function closeStablePublishedReview(

  repository: ImportReviewQueueRepository,

  existing: ImportReviewQueueEntry,

  record: ImportRecord,

  source: SourceRecord,

  options: {

    jobId?: string;

    decision: TrustPublishEvaluation['decision'] | 'review_required';

    qualityScore?: number;

    trustScore?: number;

    reasons: string[];

    affectedFields: string[];

    ruleIds: string[];

    metadata?: Record<string, unknown>;

    resolvedBy: string;

  },

): Promise<ImportReviewQueueEntry> {

  const now = new Date().toISOString();

  return repository.upsert({

    ...existing,

    importRecordId: record.id,

    importJobId: existing.importJobId ?? options.jobId ?? record.importJobId,

    status: 'expired',

    decision: options.decision,

    qualityScore: options.qualityScore ?? existing.qualityScore,

    trustScore: options.trustScore ?? existing.trustScore,

    reasons: options.reasons,

    affectedFields: options.affectedFields,

    ruleIds: options.ruleIds,

    metadata: {

      ...(existing.metadata ?? {}),

      ...(options.metadata ?? {}),

      resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport,

      resolvedAt: now,

      resolvedBy: options.resolvedBy,

      priorStatus: existing.status,

      priorDecision: existing.decision,

      priorQualityScore: existing.qualityScore,

      priorTrustScore: existing.trustScore,

      priorReasons: existing.reasons,

      sourceName: source.displayName,

    },

    updatedAt: now,

  });

}



export class ImportReviewQueueService {

  constructor(private readonly repository: ImportReviewQueueRepository) {}



  async reconcileFromEvaluation(

    record: ImportRecord,

    source: SourceRecord,

    evaluation: TrustPublishEvaluation,

    jobId?: string,

    existingEvent?: AdminEventRecord | null,

  ): Promise<ImportReviewReconcileResult> {

    const now = new Date().toISOString();

    const existing = await this.repository.findActiveBySourceAndExternalEventId(

      source.id,

      record.externalId,

    );



    if (existing && isStaleRepublishTrustReview(record, evaluation, existingEvent)) {

      const closed = await this.repository.upsert({

        ...existing,

        importRecordId: record.id,

        importJobId: existing.importJobId ?? jobId ?? record.importJobId,

        status: 'expired',

        decision: evaluation.decision,

        qualityScore: evaluation.qualityScore,

        trustScore: evaluation.trustScore,

        reasons: evaluation.reasons,

        affectedFields: evaluation.affectedFields,

        ruleIds: evaluation.ruleIds,

        metadata: {

          ...buildReviewMetadata(evaluation, source, existing.metadata),

          resolutionReason:

            evaluation.decision === 'auto_publish'

              ? IMPORT_REVIEW_RESOLUTION_REASONS.evaluationImprovedToAutoPublish

              : IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport,

          resolvedAt: now,

          resolvedBy: 'system:trust-reconciliation',

          priorStatus: existing.status,

          priorDecision: existing.decision,

          priorQualityScore: existing.qualityScore,

          priorTrustScore: existing.trustScore,

          priorReasons: existing.reasons,

        },

        updatedAt: now,

      });



      return { action: 'closed', entry: closed };

    }



    if (isStaleRepublishTrustReview(record, evaluation, existingEvent)) {

      return { action: 'none', entry: null };

    }



    if (evaluation.decision === 'auto_publish') {

      if (!existing) {

        return { action: 'none', entry: null };

      }



      const closed = await this.repository.upsert({

        ...existing,

        importRecordId: record.id,

        importJobId: existing.importJobId,

        status: 'expired',

        decision: evaluation.decision,

        qualityScore: evaluation.qualityScore,

        trustScore: evaluation.trustScore,

        reasons: evaluation.reasons,

        affectedFields: evaluation.affectedFields,

        ruleIds: evaluation.ruleIds,

        metadata: {

          ...buildReviewMetadata(evaluation, source, existing.metadata),

          resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.evaluationImprovedToAutoPublish,

          resolvedAt: now,

          resolvedBy: 'system:trust-reconciliation',

          priorStatus: existing.status,

          priorDecision: existing.decision,

          priorQualityScore: existing.qualityScore,

          priorTrustScore: existing.trustScore,

          priorReasons: existing.reasons,

        },

        updatedAt: now,

      });



      return { action: 'closed', entry: closed };

    }



    const status = evaluation.decision === 'hold' ? 'on_hold' : 'pending';



    if (existing) {

      const updated = await this.repository.upsert({

        ...existing,

        importRecordId: record.id,

        importJobId:
          record.id !== existing.importRecordId
            ? (jobId ?? record.importJobId ?? existing.importJobId)
            : (existing.importJobId ?? jobId ?? record.importJobId),

        status,

        decision: evaluation.decision,

        qualityScore: evaluation.qualityScore,

        trustScore: evaluation.trustScore,

        reasons: evaluation.reasons,

        affectedFields: evaluation.affectedFields,

        ruleIds: evaluation.ruleIds,

        metadata: buildReviewMetadata(evaluation, source, existing.metadata),

        updatedAt: now,

      });

      return { action: 'updated', entry: updated };

    }



    const created = await this.repository.upsert({

      id: createReviewQueueId(),

      importRecordId: record.id,

      importJobId: jobId,

      sourceId: source.id,

      externalEventId: record.externalId,

      status,

      decision: evaluation.decision,

      qualityScore: evaluation.qualityScore,

      trustScore: evaluation.trustScore,

      reasons: evaluation.reasons,

      affectedFields: evaluation.affectedFields,

      ruleIds: evaluation.ruleIds,

      metadata: buildReviewMetadata(evaluation, source),

      createdAt: now,

      updatedAt: now,

    });

    return { action: 'created', entry: created };

  }



  async ensureQueuedForReview(
    record: ImportRecord,
    source: SourceRecord,
    evaluation: TrustPublishEvaluation | null,
    jobId?: string,
    reason = 'import_record_requires_manual_review',
  ): Promise<ImportReviewReconcileResult> {
    const existing = await this.repository.findActiveBySourceAndExternalEventId(
      source.id,
      record.externalId,
    );
    if (existing) {
      return { action: 'none', entry: existing };
    }

    if (evaluation) {
      return this.reconcileFromEvaluation(record, source, evaluation, jobId);
    }

    return this.reconcilePublishFailure(record, source, null, reason, jobId);
  }

  async reconcilePublishFailure(

    record: ImportRecord,

    source: SourceRecord,

    evaluation: TrustPublishEvaluation | null,

    errorMessage: string,

    jobId?: string,

  ): Promise<ImportReviewReconcileResult> {

    const now = new Date().toISOString();

    const existing = await this.repository.findActiveBySourceAndExternalEventId(

      source.id,

      record.externalId,

    );

    const failureEvaluation: TrustPublishEvaluation =

      evaluation ?? {

        decision: 'review_required',

        qualityScore: 0,

        trustScore: source.computedTrustScore ?? source.trustScore,

        reasons: [errorMessage],

        affectedFields: [],

        ruleIds: [],

        violations: [],

        quality: {

          score: 0,

          tier: 'D',

          completeness: 0,

          missingFields: [],

          blockingIssues: [],

          warnings: [],

          violations: [],

          calculatedAt: now,

        },

      };



    const metadata = {

      ...buildReviewMetadata(failureEvaluation, source, existing?.metadata),

      resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.publishFailed,

      publishError: errorMessage,

      failedAt: now,

      failedBy: 'system:auto-publish',

    };



    if (existing) {

      const updated = await this.repository.upsert({

        ...existing,

        importRecordId: record.id,

        importJobId: existing.importJobId,

        status: 'pending',

        decision: 'review_required',

        qualityScore: failureEvaluation.qualityScore,

        trustScore: failureEvaluation.trustScore,

        reasons: [errorMessage, ...failureEvaluation.reasons],

        affectedFields: failureEvaluation.affectedFields,

        ruleIds: failureEvaluation.ruleIds,

        metadata,

        updatedAt: now,

      });

      return { action: 'updated', entry: updated };

    }



    const created = await this.repository.upsert({

      id: createReviewQueueId(),

      importRecordId: record.id,

      importJobId: jobId,

      sourceId: source.id,

      externalEventId: record.externalId,

      status: 'pending',

      decision: 'review_required',

      qualityScore: failureEvaluation.qualityScore,

      trustScore: failureEvaluation.trustScore,

      reasons: [errorMessage, ...failureEvaluation.reasons],

      affectedFields: failureEvaluation.affectedFields,

      ruleIds: failureEvaluation.ruleIds,

      metadata,

      createdAt: now,

      updatedAt: now,

    });

    return { action: 'created', entry: created };

  }



  async reconcileStablePublishedReimport(

    record: ImportRecord,

    source: SourceRecord,

    evaluation: TrustPublishEvaluation | null,

    existingEvent?: AdminEventRecord | null,

    jobId?: string,

  ): Promise<ImportReviewReconcileResult> {

    if (!evaluation || !isStablePublishedTrustReimport(record, evaluation, { existingEvent })) {

      return { action: 'none', entry: null };

    }



    return this.reconcileFromEvaluation(record, source, evaluation, jobId, existingEvent);

  }



  async enqueueFromEvaluation(

    record: ImportRecord,

    source: SourceRecord,

    evaluation: TrustPublishEvaluation,

    jobId?: string,

  ) {

    const result = await this.reconcileFromEvaluation(record, source, evaluation, jobId);

    if (evaluation.decision === 'auto_publish') {

      return null;

    }

    return result.entry;

  }



  async listPending(limit = 100) {

    return this.repository.listPending(limit);

  }



  async listBySource(sourceId: string, limit = 50) {

    return this.repository.listBySourceId(sourceId, limit);

  }



  async enqueueFromMatchEvaluation(

    record: ImportRecord,

    source: SourceRecord,

    evaluation: MultiSourceMatchEvaluation,

    jobId?: string,

    existingEvent?: AdminEventRecord | null,

  ) {

    if (isStablePublishedMatchReimport(record, evaluation, { existingEvent })) {

      const reconcileResult = await this.reconcileFromMatchEvaluation(

        record,

        source,

        evaluation,

        jobId,

        existingEvent,

      );

      return reconcileResult.entry;

    }



    const reconcileResult = await this.reconcileFromMatchEvaluation(

      record,

      source,

      evaluation,

      jobId,

      existingEvent,

    );

    if (reconcileResult.action === 'closed' || evaluation.decision === 'auto_link') {

      return reconcileResult.entry;

    }



    const now = new Date().toISOString();

    const existing = await this.repository.findActiveBySourceAndExternalEventId(

      source.id,

      record.externalId,

    );

    const payload = {

      importRecordId: record.id,

      importJobId: existing?.importJobId ?? jobId ?? record.importJobId,

      sourceId: source.id,

      externalEventId: record.externalId,

      status: 'pending' as const,

      decision: 'review_required' as const,

      qualityScore: evaluation.confidenceScore,

      trustScore: undefined,

      reasons: evaluation.reasons,

      affectedFields: evaluation.fieldDifferences.map((difference) => difference.field),

      ruleIds: [],

      metadata: {

        ...(existing?.metadata ?? {}),

        reviewType: 'multi_source_match',

        confidenceTier: evaluation.confidenceTier,

        confidenceScore: evaluation.confidenceScore,

        canonicalEventId: evaluation.canonicalEventId,

        involvedSourceIds: evaluation.involvedSourceIds,

        fieldDifferences: evaluation.fieldDifferences,

        matchSignals: evaluation.signals,

        sourceName: source.displayName,

      },

      updatedAt: now,

    };

    if (existing) {

      return this.repository.upsert({

        ...existing,

        ...payload,

      });

    }

    return this.repository.upsert({

      id: createReviewQueueId(),

      ...payload,

      createdAt: now,

    });

  }



  async enqueueFromLifecycleEvaluation(

    record: ImportRecord,

    source: SourceRecord,

    evaluation: EventLifecycleEvaluation,

    jobId?: string,

    existingEvent?: AdminEventRecord | null,

  ) {

    if (isStablePublishedLifecycleReimport(record, evaluation, { existingEvent })) {

      const reconcileResult = await this.reconcileFromLifecycleEvaluation(

        record,

        source,

        evaluation,

        jobId,

        existingEvent,

      );

      return reconcileResult.entry;

    }



    const reconcileResult = await this.reconcileFromLifecycleEvaluation(

      record,

      source,

      evaluation,

      jobId,

      existingEvent,

    );

    if (

      reconcileResult.action === 'closed' ||

      evaluation.decision === 'ignore' ||

      evaluation.decision === 'apply_immediately'

    ) {

      return reconcileResult.entry;

    }



    const now = new Date().toISOString();

    const existing = await this.repository.findActiveBySourceAndExternalEventId(

      source.id,

      record.externalId,

    );

    const payload = {

      importRecordId: record.id,

      importJobId: existing?.importJobId ?? jobId ?? record.importJobId,

      sourceId: source.id,

      externalEventId: record.externalId,

      status: 'pending' as const,

      decision: 'review_required' as const,

      qualityScore: evaluation.confidenceScore,

      trustScore: source.computedTrustScore ?? source.trustScore,

      reasons: evaluation.reasons,

      affectedFields: evaluation.changes.map((change) => change.fieldPath),

      ruleIds: [],

      metadata: {

        ...(existing?.metadata ?? {}),

        reviewType: 'event_lifecycle',

        lifecycleEventType: evaluation.lifecycleEventType,

        lifecycleDecision: evaluation.decision,

        lifecycleStatusBefore: evaluation.lifecycleStatusBefore,

        lifecycleStatusAfter: evaluation.lifecycleStatusAfter,

        changes: evaluation.changes,

        sourceName: source.displayName,

      },

      updatedAt: now,

    };

    if (existing) {

      return this.repository.upsert({

        ...existing,

        ...payload,

      });

    }

    return this.repository.upsert({

      id: createReviewQueueId(),

      ...payload,

      createdAt: now,

    });

  }



  async reconcileFromMatchEvaluation(
    record: ImportRecord,
    source: SourceRecord,
    evaluation: MultiSourceMatchEvaluation,
    jobId?: string,
    existingEvent?: AdminEventRecord | null,
  ): Promise<ImportReviewReconcileResult> {
    const now = new Date().toISOString();
    const existing = await this.repository.findActiveBySourceAndExternalEventId(
      source.id,
      record.externalId,
    );

    const publishedRecord =
      recordHasPublishedOutcome(record, existingEvent) &&
      evaluation.canonicalEventId === record.resultingEventId;
    const shouldClosePublishedMatch =
      evaluation.decision === 'auto_link' ||
      (publishedRecord && evaluation.decision !== 'keep_separate');

    if (existing && shouldClosePublishedMatch) {
      const closed = await this.repository.upsert({
        ...existing,
        importRecordId: record.id,
        importJobId: existing.importJobId ?? jobId ?? record.importJobId,
        status: 'expired',
        decision: 'auto_publish',
        qualityScore: evaluation.confidenceScore,
        trustScore: existing.trustScore,
        reasons: evaluation.reasons,
        affectedFields: evaluation.fieldDifferences.map((difference) => difference.field),
        ruleIds: [],
        metadata: {
          ...(existing.metadata ?? {}),
          reviewType: 'multi_source_match',
          resolutionReason:
            evaluation.decision === 'auto_link'
              ? IMPORT_REVIEW_RESOLUTION_REASONS.matchResolvedAutoLink
              : IMPORT_REVIEW_RESOLUTION_REASONS.matchResolvedOnPublishedRecord,
          resolvedAt: now,
          resolvedBy: 'system:match-reconciliation',
          canonicalEventId: evaluation.canonicalEventId,
          priorStatus: existing.status,
          priorDecision: existing.decision,
          priorQualityScore: existing.qualityScore,
          priorReasons: existing.reasons,
        },
        updatedAt: now,
      });

      return { action: 'closed', entry: closed };
    }

    if (isStablePublishedMatchReimport(record, evaluation, { existingEvent })) {
      if (!existing) {
        return { action: 'none', entry: null };
      }

      const closed = await closeStablePublishedReview(this.repository, existing, record, source, {
        jobId,
        decision: 'review_required',
        qualityScore: evaluation.confidenceScore,
        trustScore: existing.trustScore,
        reasons: evaluation.reasons,
        affectedFields: evaluation.fieldDifferences.map((difference) => difference.field),
        ruleIds: [],
        metadata: {
          reviewType: 'multi_source_match',
          canonicalEventId: evaluation.canonicalEventId,
        },
        resolvedBy: 'system:match-reconciliation',
      });

      return { action: 'closed', entry: closed };
    }

    return { action: 'none', entry: null };
  }



  async reconcileFromLifecycleEvaluation(
    record: ImportRecord,
    source: SourceRecord,
    evaluation: EventLifecycleEvaluation,
    jobId?: string,
    existingEvent?: AdminEventRecord | null,
  ): Promise<ImportReviewReconcileResult> {
    const now = new Date().toISOString();
    const existing = await this.repository.findActiveBySourceAndExternalEventId(
      source.id,
      record.externalId,
    );

    const publishSucceeded = recordHasPublishedOutcome(record, existingEvent);
    const shouldCloseLifecycle =
      evaluation.decision === 'ignore' ||
      evaluation.decision === 'apply_immediately' ||
      (publishSucceeded &&
        existing?.metadata?.resolutionReason === IMPORT_REVIEW_RESOLUTION_REASONS.publishFailed);

    if (existing && shouldCloseLifecycle) {
      const closed = await this.repository.upsert({
        ...existing,
        importRecordId: record.id,
        importJobId: existing.importJobId ?? jobId ?? record.importJobId,
        status: 'expired',
        decision: 'auto_publish',
        qualityScore: evaluation.confidenceScore,
        trustScore: source.computedTrustScore ?? source.trustScore,
        reasons: evaluation.reasons,
        affectedFields: evaluation.changes.map((change) => change.fieldPath),
        ruleIds: [],
        metadata: {
          ...(existing.metadata ?? {}),
          reviewType: 'event_lifecycle',
          resolutionReason:
            evaluation.decision === 'ignore'
              ? IMPORT_REVIEW_RESOLUTION_REASONS.lifecycleResolvedIgnored
              : IMPORT_REVIEW_RESOLUTION_REASONS.lifecycleResolvedOnPublishSuccess,
          resolvedAt: now,
          resolvedBy: 'system:lifecycle-reconciliation',
          lifecycleEventType: evaluation.lifecycleEventType,
          priorStatus: existing.status,
          priorDecision: existing.decision,
          priorQualityScore: existing.qualityScore,
          priorReasons: existing.reasons,
        },
        updatedAt: now,
      });

      return { action: 'closed', entry: closed };
    }

    if (isStablePublishedLifecycleReimport(record, evaluation, { existingEvent })) {
      if (!existing) {
        return { action: 'none', entry: null };
      }

      const closed = await closeStablePublishedReview(this.repository, existing, record, source, {
        jobId,
        decision: 'review_required',
        qualityScore: evaluation.confidenceScore,
        trustScore: source.computedTrustScore ?? source.trustScore,
        reasons: evaluation.reasons,
        affectedFields: evaluation.changes.map((change) => change.fieldPath),
        ruleIds: [],
        metadata: {
          reviewType: 'event_lifecycle',
          lifecycleEventType: evaluation.lifecycleEventType,
        },
        resolvedBy: 'system:lifecycle-reconciliation',
      });

      return { action: 'closed', entry: closed };
    }

    return { action: 'none', entry: null };
  }
}


