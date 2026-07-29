/**
 * Sprint 26.9.1 — reconcile stale Bootshaus reviews via generic lifecycle/match reconciliation.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adminSourceRepository,
  importRecordRepository,
  importReviewQueueService,
} from '@/data/repositories/registry';
import { getSupabaseServiceClient } from '@/services/supabase/client';
import { IMPORT_REVIEW_RESOLUTION_REASONS } from '@/features/trust-quality/domain/trust-quality-types';
import type { MultiSourceMatchEvaluation } from '@/features/multi-source-matching/domain/matching-types';
import type { EventLifecycleEvaluation } from '@/features/event-lifecycle/domain/lifecycle-engine-types';

const BOOTSHAUS = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_production_closure.json');

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

    const reviewType = (review.metadata as { reviewType?: string } | null)?.reviewType;

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
      const result = await importReviewQueueService.reconcileFromMatchEvaluation(
        record,
        source,
        evaluation,
        record.importJobId,
      );
      traces.push({
        reviewId: review.id,
        reviewType,
        action: result.action,
        importRecordId: record.id,
        recordStatus: record.status,
        resultingEventId: record.resultingEventId ?? null,
      });
      continue;
    }

    if (reviewType === 'event_lifecycle') {
      const metadata = review.metadata as {
        lifecycleEventType?: EventLifecycleEvaluation['lifecycleEventType'];
        lifecycleDecision?: string;
      };
      const evaluation: EventLifecycleEvaluation = {
        id: `reeval-${review.id}`,
        canonicalEventId: record.resultingEventId ?? review.external_event_id,
        lifecycleEventType: metadata.lifecycleEventType ?? 'event_updated',
        decision: 'apply_immediately',
        changes: [],
        confidenceScore: review.quality_score ?? 80,
        reasons: review.reasons ?? [],
        sourceId: record.sourceId,
        importJobId: record.importJobId,
        importRecordId: record.id,
        createdAt: new Date().toISOString(),
      };

      const priorResolution = (review.metadata as { resolutionReason?: string } | null)
        ?.resolutionReason;
      if (
        priorResolution === IMPORT_REVIEW_RESOLUTION_REASONS.publishFailed &&
        (record.status === 'imported' ||
          record.status === 'approved' ||
          record.status === 'duplicate') &&
        record.resultingEventId
      ) {
        const result = await importReviewQueueService.reconcileFromLifecycleEvaluation(
          record,
          source,
          evaluation,
          record.importJobId,
        );
        traces.push({
          reviewId: review.id,
          reviewType,
          action: result.action,
          reason: 'publish_failed_resolved',
          importRecordId: record.id,
        });
        continue;
      }

      traces.push({
        reviewId: review.id,
        reviewType,
        action: 'kept_active',
        reason: 'lifecycle_change_still_requires_review',
        importRecordId: record.id,
        reasons: review.reasons,
      });
      continue;
    }

    traces.push({ reviewId: review.id, reviewType, action: 'unhandled' });
  }

  const { data: remaining } = await client
    .from('import_review_queue')
    .select('id, metadata, status, reasons')
    .eq('source_id', BOOTSHAUS)
    .in('status', ['pending', 'on_hold']);

  const report = {
    capturedAt: new Date().toISOString(),
    phase: 'review_reconciliation',
    traces,
    remainingActiveReviews: remaining?.length ?? 0,
    remaining,
  };

  const existing = JSON.parse(
    await import('node:fs').then((fs) =>
      fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '{}',
    ),
  );
  writeFileSync(OUT, JSON.stringify({ ...existing, reviewReconciliation: report }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
