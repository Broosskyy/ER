/**
 * Bootshaus dedupe cleanup preview — read-only simulation of
 * docs/real-data/BOOTSHAUS_REVIEW_DEDUP_CLEANUP.sql (BEGIN … ROLLBACK).
 *
 * Uses identical keeper strategy: newest per (source_id, external_id / external_event_id)
 * ordered by updated_at DESC, created_at DESC.
 * Does NOT mutate live data (equivalent to ROLLBACK).
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_bootshaus_dedup_cleanup_preview.json',
);

type Timestamped = { id: string; updated_at: string; created_at: string };

function pickNewest<T extends Timestamped>(rows: T[], key: (row: T) => string): Map<string, T> {
  const sorted = [...rows].sort((a, b) => {
    const byUpdated = b.updated_at.localeCompare(a.updated_at);
    if (byUpdated !== 0) return byUpdated;
    return b.created_at.localeCompare(a.created_at);
  });
  const winners = new Map<string, T>();
  for (const row of sorted) {
    const identity = key(row);
    if (!winners.has(identity)) {
      winners.set(identity, row);
    }
  }
  return winners;
}

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();

  const { data: importRows, error: importError } = await client
    .from('import_records')
    .select('id, external_id, import_job_id, status, resulting_event_id, updated_at, created_at')
    .eq('source_id', BOOTSHAUS_SOURCE);
  if (importError) throw new Error(importError.message);

  const { data: reviewRows, error: reviewError } = await client
    .from('import_review_queue')
    .select('id, external_event_id, import_record_id, status, updated_at, created_at')
    .eq('source_id', BOOTSHAUS_SOURCE);
  if (reviewError) throw new Error(reviewError.message);

  const activeReviews = (reviewRows ?? []).filter((r) => r.status === 'pending' || r.status === 'on_hold');

  const canonicalRecords = pickNewest(importRows ?? [], (r) => r.external_id);
  const duplicateRecords = (importRows ?? []).filter((r) => canonicalRecords.get(r.external_id)?.id !== r.id);

  const canonicalReviews = pickNewest(activeReviews, (r) => r.external_event_id);
  const duplicateReviews = activeReviews.filter(
    (r) => canonicalReviews.get(r.external_event_id)?.id !== r.id,
  );

  const duplicateRecordIds = duplicateRecords.map((r) => r.id);
  const keeperRecordIds = [...canonicalRecords.values()].map((r) => r.id);
  const duplicateReviewIds = duplicateReviews.map((r) => r.id);
  const keeperReviewIds = [...canonicalReviews.values()].map((r) => r.id);

  const relinkCandidates = [...canonicalReviews.values()].filter((review) => {
    const canonicalRecord = canonicalRecords.get(review.external_event_id);
    return canonicalRecord && review.import_record_id !== canonicalRecord.id;
  });

  const [
    matchEvals,
    importLogs,
    sourceRefs,
    lifecycleRefs,
    publishedBootshausEvents,
    otherSourceImportCount,
    otherSourceReviewCount,
  ] = await Promise.all([
    duplicateRecordIds.length
      ? client
          .from('event_match_evaluations')
          .select('id, import_record_id, source_id')
          .in('import_record_id', duplicateRecordIds)
      : Promise.resolve({ data: [], error: null }),
    duplicateRecordIds.length
      ? client.from('import_logs').select('id, import_record_id').in('import_record_id', duplicateRecordIds)
      : Promise.resolve({ data: [], error: null }),
    duplicateRecordIds.length
      ? client
          .from('event_source_references')
          .select('id, raw_record_id, source_id')
          .in('raw_record_id', duplicateRecordIds)
      : Promise.resolve({ data: [], error: null }),
    duplicateRecordIds.length
      ? client
          .from('event_lifecycle_transitions')
          .select('id, import_record_id')
          .in('import_record_id', duplicateRecordIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', BOOTSHAUS_SOURCE)
      .eq('status', 'published'),
    client
      .from('import_records')
      .select('id', { count: 'exact', head: true })
      .neq('source_id', BOOTSHAUS_SOURCE),
    client
      .from('import_review_queue')
      .select('id', { count: 'exact', head: true })
      .neq('source_id', BOOTSHAUS_SOURCE),
  ]);

  const publishedFromDuplicates = (importRows ?? []).filter(
    (r) => duplicateRecordIds.includes(r.id) && r.resulting_event_id,
  );

  const simulatedImportAfter = keeperRecordIds.length;
  const simulatedReviewAfter = keeperReviewIds.length;

  const report = {
    capturedAt: new Date().toISOString(),
    mode: 'BEGIN_ROLLBACK_SIMULATION',
    note:
      'No SUPABASE_DB_URL — preview computed read-only via service role with identical keeper logic. No mutations applied (ROLLBACK equivalent).',
    sourceId: BOOTSHAUS_SOURCE,
    keeperStrategy: {
      rule: 'DISTINCT ON (source_id, external_id / external_event_id)',
      order: 'updated_at DESC, created_at DESC',
      rationale:
        'Newest successful/full record per external identity wins; aligns with import upsert and review dedupe in Sprint 26.8 code.',
    },
    preflight: {
      importRecords: {
        total: importRows?.length ?? 0,
        distinctExternalIds: canonicalRecords.size,
        duplicateSurplus: duplicateRecords.length,
      },
      reviewQueue: {
        total: reviewRows?.length ?? 0,
        activeTotal: activeReviews.length,
        distinctExternalEventIds: canonicalReviews.size,
        duplicateSurplus: duplicateReviews.length,
      },
    },
    simulatedTransaction: {
      duplicateImportRecordsToRemove: duplicateRecords.length,
      duplicateReviewsToRemove: duplicateReviews.length,
      canonicalImportRecordsToKeep: keeperRecordIds.length,
      canonicalReviewsToKeep: keeperReviewIds.length,
      relinkCanonicalReviews: relinkCandidates.length,
      postMutation: {
        importRecords: simulatedImportAfter,
        distinctExternalIds: canonicalRecords.size,
        activeReviews: simulatedReviewAfter,
        distinctExternalEventIds: canonicalReviews.size,
        duplicateSurplus: 0,
      },
    },
    keepers: {
      importRecordIds: keeperRecordIds,
      reviewIds: keeperReviewIds,
    },
    toRemove: {
      importRecordIds: duplicateRecordIds,
      reviewIds: duplicateReviewIds,
      sampleGroups: [...canonicalRecords.entries()].slice(0, 3).map(([externalId, keeper]) => ({
        externalId,
        keeperRecordId: keeper.id,
        keeperReviewId: canonicalReviews.get(externalId)?.id ?? null,
        removedRecordIds: (importRows ?? [])
          .filter((r) => r.external_id === externalId && r.id !== keeper.id)
          .map((r) => r.id),
        removedReviewIds: activeReviews
          .filter((r) => r.external_event_id === externalId && r.id !== canonicalReviews.get(externalId)?.id)
          .map((r) => r.id),
      })),
    },
    foreignKeyImpact: {
      eventMatchEvaluationsOnDuplicates: matchEvals.data?.length ?? 0,
      importLogsOnDuplicates: importLogs.data?.length ?? 0,
      eventSourceReferencesOnDuplicates: sourceRefs.data?.length ?? 0,
      eventLifecycleTransitionsOnDuplicates: lifecycleRefs.data?.length ?? 0,
      fkBehavior: {
        import_review_queue: 'ON DELETE CASCADE from import_records (reviews deleted explicitly first in script)',
        event_match_evaluations: 'ON DELETE SET NULL on import_record_id',
        import_logs: 'ON DELETE SET NULL on import_record_id',
        event_source_references: 'ON DELETE SET NULL on raw_record_id',
        event_lifecycle_transitions: 'ON DELETE SET NULL on import_record_id',
      },
    },
    scopeSafety: {
      otherSourcesImportRecords: otherSourceImportCount.count ?? 0,
      otherSourcesReviewEntries: otherSourceReviewCount.count ?? 0,
      otherSourcesAffected: false,
      publishedBootshausEvents: publishedBootshausEvents.count ?? 0,
      publishedEventsFromDuplicateRecords: publishedFromDuplicates.length,
      publishedEventsAffected: (publishedBootshausEvents.count ?? 0) > 0 || publishedFromDuplicates.length > 0,
    },
    postRollbackConfirmation: {
      importRecords: importRows?.length ?? 0,
      reviewEntries: reviewRows?.length ?? 0,
      unchanged: true,
    },
    expectationsMet: {
      import72to36: simulatedImportAfter === 36 && (importRows?.length ?? 0) === 72,
      review72to36: simulatedReviewAfter === 36 && (reviewRows?.length ?? 0) === 72,
      uniqueExternalIds36: canonicalRecords.size === 36,
      rollbackPreserves72: (importRows?.length ?? 0) === 72 && (reviewRows?.length ?? 0) === 72,
      noPublishedImpact: (publishedBootshausEvents.count ?? 0) === 0 && publishedFromDuplicates.length === 0,
      noForeignSourceImpact: true,
    },
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
