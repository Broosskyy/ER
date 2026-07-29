/**
 * Sprint 26.9.2 — close stale Bootshaus reviews from stable published reimports.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adminEventRepository,
  adminSourceRepository,
  importRecordRepository,
  importReviewQueueService,
} from '@/data/repositories/registry';
import { getSupabaseServiceClient } from '@/services/supabase/client';
import {
  detectSemanticChangeSet,
  isStablePublishedMatchReimport,
  isStablePublishedTrustReimport,
} from '@/features/import/services/published-reimport-reconciliation';
import { TrustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';
import { ImportRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { SourceTrustEngine } from '@/features/trust-quality/services/source-trust-engine';
import { resolvePublishPolicy } from '@/features/import/domain/publish-mode';
import type { MultiSourceMatchEvaluation } from '@/features/multi-source-matching/domain/matching-types';
import type { EventLifecycleEvaluation } from '@/features/event-lifecycle/domain/lifecycle-engine-types';
import { IMPORT_REVIEW_RESOLUTION_REASONS } from '@/features/trust-quality/domain/trust-quality-types';

const BOOTSHAUS = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_stable_reimport_reconciliation.json');

const trustEngine = new TrustPublishDecisionEngine(
  new ImportRecordQualityEvaluator(),
  new SourceTrustEngine(),
);

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();
  const source = await adminSourceRepository.getById(BOOTSHAUS);
  if (!source) throw new Error('Bootshaus source missing');

  const { data: activeReviews } = await client
    .from('import_review_queue')
    .select('*')
    .eq('source_id', BOOTSHAUS)
    .in('status', ['pending', 'on_hold']);

  const traces: Array<Record<string, unknown>> = [];

  for (const review of activeReviews ?? []) {
    const record = await importRecordRepository.getById(review.import_record_id);
    if (!record) {
      traces.push({ reviewId: review.id, action: 'skipped', reason: 'record_missing' });
      continue;
    }

    const existingEvent = record.resultingEventId
      ? await adminEventRepository.getById(record.resultingEventId)
      : null;
    const changeSet = detectSemanticChangeSet(record, existingEvent);
    const reviewType = (review.metadata as { reviewType?: string } | null)?.reviewType ?? 'trust';

    if (!record.resultingEventId || existingEvent?.status !== 'published') {
      traces.push({
        reviewId: review.id,
        action: 'kept_active',
        reason: 'not_published_record',
        reviewType,
      });
      continue;
    }

    if (changeSet.changeType !== 'unchanged') {
      traces.push({
        reviewId: review.id,
        action: 'kept_active',
        reason: 'semantic_change_detected',
        reviewType,
        changedFields: changeSet.changedFields,
      });
      continue;
    }

    if (reviewType === 'multi_source_match') {
      const metadata = review.metadata as {
        canonicalEventId?: string;
        fieldDifferences?: MultiSourceMatchEvaluation['fieldDifferences'];
        confidenceScore?: number;
      };
      const evaluation: MultiSourceMatchEvaluation = {
        id: `reeval-${review.id}`,
        importRecordId: record.id,
        importJobId: record.importJobId,
        sourceId: record.sourceId,
        externalEventId: record.externalId,
        canonicalEventId: metadata.canonicalEventId ?? record.resultingEventId,
        involvedSourceIds: [record.sourceId],
        confidenceScore: metadata.confidenceScore ?? review.quality_score ?? 97,
        confidenceTier: 'certain',
        decision: 'review_required',
        reasons: review.reasons ?? [],
        fieldDifferences: metadata.fieldDifferences ?? [],
        signals: [],
        fingerprintSnapshot: {},
        createdAt: new Date().toISOString(),
      };

      if (!isStablePublishedMatchReimport(record, evaluation, { existingEvent })) {
        traces.push({ reviewId: review.id, action: 'kept_active', reason: 'match_not_stable', reviewType });
        continue;
      }

      const result = await importReviewQueueService.reconcileFromMatchEvaluation(
        record,
        source,
        evaluation,
        record.importJobId,
        existingEvent,
      );
      traces.push({
        reviewId: review.id,
        action: result.action,
        reviewType,
        resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport,
      });
      continue;
    }

    if (reviewType === 'event_lifecycle') {
      const metadata = review.metadata as {
        lifecycleEventType?: EventLifecycleEvaluation['lifecycleEventType'];
      };
      const evaluation: EventLifecycleEvaluation = {
        id: `reeval-${review.id}`,
        canonicalEventId: record.resultingEventId,
        lifecycleEventType: metadata.lifecycleEventType ?? 'event_updated',
        decision: 'review_required',
        changes: [],
        confidenceScore: review.quality_score ?? 80,
        reasons: review.reasons ?? [],
        sourceId: record.sourceId,
        importJobId: record.importJobId,
        importRecordId: record.id,
        createdAt: new Date().toISOString(),
      };
      const result = await importReviewQueueService.reconcileFromLifecycleEvaluation(
        record,
        source,
        evaluation,
        record.importJobId,
        existingEvent,
      );
      traces.push({
        reviewId: review.id,
        action: result.action,
        reviewType,
        resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport,
      });
      continue;
    }

    const trustEvaluation = trustEngine.evaluate({
      source,
      record,
      policy: resolvePublishPolicy(source),
      rules: [],
    });

    if (!isStablePublishedTrustReimport(record, trustEvaluation, { existingEvent })) {
      traces.push({
        reviewId: review.id,
        action: 'kept_active',
        reason: 'trust_not_stable',
        reviewType,
        decision: trustEvaluation.decision,
        reasons: trustEvaluation.reasons,
      });
      continue;
    }

    const result = await importReviewQueueService.reconcileStablePublishedReimport(
      record,
      source,
      trustEvaluation,
      existingEvent,
      record.importJobId,
    );
    traces.push({
      reviewId: review.id,
      action: result.action,
      reviewType,
      resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport,
    });
  }

  const { data: remaining } = await client
    .from('import_review_queue')
    .select('id, metadata, status, reasons, decision, quality_score, trust_score')
    .eq('source_id', BOOTSHAUS)
    .in('status', ['pending', 'on_hold']);

  const report = {
    capturedAt: new Date().toISOString(),
    phase: 'stable_reimport_review_reconciliation',
    closedCount: traces.filter((trace) => trace.action === 'closed').length,
    keptActiveCount: traces.filter((trace) => trace.action === 'kept_active').length,
    traces,
    remainingActiveReviews: remaining?.length ?? 0,
    remaining,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
