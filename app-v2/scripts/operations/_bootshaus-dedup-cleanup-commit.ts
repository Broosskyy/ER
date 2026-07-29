/**
 * Bootshaus dedupe cleanup COMMIT — Sprint 26.8 P0
 * Executes docs/real-data/BOOTSHAUS_REVIEW_DEDUP_CLEANUP.sql logic on live DB.
 * Uses pg transaction when SUPABASE_DB_URL is set; otherwise service-role sequential apply.
 */
import './bootstrap-ops-supabase';

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';
const PRODUCTION_VENUE_ID = 'venue-bootshaus-koeln';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data/_bootshaus_dedup_cleanup_commit_result.json');
const COMMIT_SQL = join(ROOT, 'docs/real-data/BOOTSHAUS_REVIEW_DEDUP_CLEANUP_COMMIT.sql');

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
    if (!winners.has(identity)) winners.set(identity, row);
  }
  return winners;
}

async function countBootshausState() {
  const client = getSupabaseServiceClient();

  const { data: importRows } = await client
    .from('import_records')
    .select('id, external_id, resulting_event_id, updated_at, created_at')
    .eq('source_id', BOOTSHAUS_SOURCE);

  const { data: reviewRows } = await client
    .from('import_review_queue')
    .select('id, external_event_id, import_record_id, status, updated_at, created_at')
    .eq('source_id', BOOTSHAUS_SOURCE);

  const activeReviews = (reviewRows ?? []).filter((r) => r.status === 'pending' || r.status === 'on_hold');
  const uniqueExternalIds = new Set((importRows ?? []).map((r) => r.external_id));
  const uniqueExternalEventIds = new Set(activeReviews.map((r) => r.external_event_id));

  const { count: publishedEvents } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE)
    .eq('status', 'published');

  const { count: sourceRefs } = await client
    .from('event_source_references')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE);

  const { data: venue } = await client
    .from('venues')
    .select('id')
    .eq('id', PRODUCTION_VENUE_ID)
    .maybeSingle();

  const { data: source } = await client
    .from('sources')
    .select('source_config')
    .eq('id', BOOTSHAUS_SOURCE)
    .maybeSingle();

  const venueId = (source?.source_config as { defaults?: { venueId?: string } } | null)?.defaults?.venueId;

  const { count: otherImports } = await client
    .from('import_records')
    .select('id', { count: 'exact', head: true })
    .neq('source_id', BOOTSHAUS_SOURCE);

  return {
    importRecords: importRows?.length ?? 0,
    activeReviews: activeReviews.length,
    uniqueExternalIds: uniqueExternalIds.size,
    uniqueExternalEventIds: uniqueExternalEventIds.size,
    duplicateSurplus: (importRows?.length ?? 0) - uniqueExternalIds.size,
    publishedEvents: publishedEvents ?? 0,
    sourceRefs: sourceRefs ?? 0,
    hasProductionVenue: !!venue,
    defaultsVenueId: venueId ?? null,
    otherSourceImports: otherImports ?? 0,
    importRows: importRows ?? [],
    reviewRows: reviewRows ?? [],
    activeReviewRows: activeReviews,
  };
}

async function preCommitGuard(): Promise<ReturnType<typeof countBootshausState>> {
  const state = await countBootshausState();

  const failures: string[] = [];
  if (state.importRecords !== 72) failures.push(`import_records=${state.importRecords} (expected 72)`);
  if (state.activeReviews !== 72) failures.push(`active_reviews=${state.activeReviews} (expected 72)`);
  if (state.uniqueExternalIds !== 36) failures.push(`unique_external_id=${state.uniqueExternalIds} (expected 36)`);
  if (state.uniqueExternalEventIds !== 36) {
    failures.push(`unique_external_event_id=${state.uniqueExternalEventIds} (expected 36)`);
  }
  if (state.duplicateSurplus !== 36) failures.push(`duplicate_surplus=${state.duplicateSurplus} (expected 36)`);
  if (state.publishedEvents !== 0) failures.push(`published_events=${state.publishedEvents} (expected 0)`);
  if (state.sourceRefs !== 0) failures.push(`source_refs=${state.sourceRefs} (expected 0)`);
  if (!state.hasProductionVenue) failures.push('venue-bootshaus-koeln missing');
  if (state.defaultsVenueId !== PRODUCTION_VENUE_ID) {
    failures.push(`defaults.venueId=${state.defaultsVenueId ?? 'null'} (expected ${PRODUCTION_VENUE_ID})`);
  }

  if (failures.length > 0) {
    throw new Error(`Pre-commit guard failed: ${failures.join('; ')}`);
  }

  return state;
}

async function applyViaPg(dbUrl: string): Promise<{ method: string }> {
  const { Client } = await import('pg');
  const sql = readFileSync(COMMIT_SQL, 'utf8');
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    return { method: 'postgres_transaction' };
  } finally {
    await client.end();
  }
}

async function applyViaServiceRole(preState: Awaited<ReturnType<typeof preCommitGuard>>) {
  const client = getSupabaseServiceClient();

  const canonicalRecords = pickNewest(preState.importRows, (r) => r.external_id);
  const duplicateRecords = preState.importRows.filter(
    (r) => canonicalRecords.get(r.external_id)?.id !== r.id,
  );
  const canonicalReviews = pickNewest(preState.activeReviewRows, (r) => r.external_event_id);
  const duplicateReviews = preState.activeReviewRows.filter(
    (r) => canonicalReviews.get(r.external_event_id)?.id !== r.id,
  );

  if (duplicateRecords.length !== 36 || duplicateReviews.length !== 36) {
    throw new Error(
      `Duplicate counts mismatch: records=${duplicateRecords.length} reviews=${duplicateReviews.length}`,
    );
  }

  const relinks = [...canonicalReviews.values()].filter((review) => {
    const canonicalRecord = canonicalRecords.get(review.external_event_id);
    return canonicalRecord && review.import_record_id !== canonicalRecord.id;
  });

  for (const review of relinks) {
    const canonicalRecord = canonicalRecords.get(review.external_event_id)!;
    const { error } = await client
      .from('import_review_queue')
      .update({ import_record_id: canonicalRecord.id, updated_at: new Date().toISOString() })
      .eq('id', review.id);
    if (error) throw new Error(`Relink failed for ${review.id}: ${error.message}`);
  }

  const duplicateReviewIds = duplicateReviews.map((r) => r.id);
  const { error: deleteReviewsError } = await client
    .from('import_review_queue')
    .delete()
    .in('id', duplicateReviewIds);
  if (deleteReviewsError) throw new Error(`Delete reviews failed: ${deleteReviewsError.message}`);

  const duplicateRecordIds = duplicateRecords.map((r) => r.id);
  const { error: deleteRecordsError } = await client
    .from('import_records')
    .delete()
    .in('id', duplicateRecordIds);
  if (deleteRecordsError) throw new Error(`Delete records failed: ${deleteRecordsError.message}`);

  return {
    method: 'service_role_sequential',
    relinkedReviews: relinks.length,
    deletedReviewIds: duplicateReviewIds,
    deletedRecordIds: duplicateRecordIds,
    keeperRecordIds: [...canonicalRecords.values()].map((r) => r.id),
    keeperReviewIds: [...canonicalReviews.values()].map((r) => r.id),
  };
}

async function postCommitVerify() {
  const state = await countBootshausState();
  const failures: string[] = [];

  if (state.importRecords !== 36) failures.push(`import_records=${state.importRecords}`);
  if (state.activeReviews !== 36) failures.push(`active_reviews=${state.activeReviews}`);
  if (state.uniqueExternalIds !== 36) failures.push(`unique_external_id=${state.uniqueExternalIds}`);
  if (state.uniqueExternalEventIds !== 36) {
    failures.push(`unique_external_event_id=${state.uniqueExternalEventIds}`);
  }
  if (state.duplicateSurplus !== 0) failures.push(`duplicate_surplus=${state.duplicateSurplus}`);
  if (state.publishedEvents !== 0) failures.push(`published_events=${state.publishedEvents}`);
  if (state.sourceRefs !== 0) failures.push(`source_refs=${state.sourceRefs}`);
  if (!state.hasProductionVenue) failures.push('venue missing');
  if (state.defaultsVenueId !== PRODUCTION_VENUE_ID) failures.push('defaults.venueId drift');

  const client = getSupabaseServiceClient();
  const { count: evalsWithNullRecord } = await client
    .from('event_match_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE)
    .is('import_record_id', null);

  const { count: evalsTotal } = await client
    .from('event_match_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE);

  if (failures.length > 0) {
    throw new Error(`Post-commit verification failed: ${failures.join('; ')}`);
  }

  return {
    ...state,
    matchEvaluationsTotal: evalsTotal ?? 0,
    matchEvaluationsNullImportRecordId: evalsWithNullRecord ?? 0,
  };
}

async function main(): Promise<void> {
  console.log('==> Phase 1: Pre-commit guard');
  const preState = await preCommitGuard();
  console.log('✅ Pre-commit guard passed');

  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  let applyMeta: Record<string, unknown>;

  console.log('==> Phase 3: Execute cleanup');
  if (dbUrl) {
    applyMeta = await applyViaPg(dbUrl);
  } else {
    applyMeta = await applyViaServiceRole(preState);
  }
  console.log(`✅ Cleanup applied via ${applyMeta.method}`);

  console.log('==> Phase 4: Post-commit verification');
  const postState = await postCommitVerify();
  console.log('✅ Post-commit verification passed');

  const result = {
    capturedAt: new Date().toISOString(),
    outcome: 'COMMIT',
    keeperStrategy: {
      rule: 'newest per source_id + external_id / external_event_id',
      order: 'updated_at DESC, created_at DESC',
    },
    before: {
      importRecords: preState.importRecords,
      activeReviews: preState.activeReviews,
      uniqueExternalIds: preState.uniqueExternalIds,
      uniqueExternalEventIds: preState.uniqueExternalEventIds,
      duplicateSurplus: preState.duplicateSurplus,
      publishedEvents: preState.publishedEvents,
      sourceRefs: preState.sourceRefs,
    },
    apply: applyMeta,
    after: {
      importRecords: postState.importRecords,
      activeReviews: postState.activeReviews,
      uniqueExternalIds: postState.uniqueExternalIds,
      uniqueExternalEventIds: postState.uniqueExternalEventIds,
      duplicateSurplus: postState.duplicateSurplus,
      publishedEvents: postState.publishedEvents,
      sourceRefs: postState.sourceRefs,
      defaultsVenueId: postState.defaultsVenueId,
      hasProductionVenue: postState.hasProductionVenue,
      otherSourceImports: postState.otherSourceImports,
    },
    eventMatchEvaluations: {
      totalForSource: postState.matchEvaluationsTotal,
      nullImportRecordId: postState.matchEvaluationsNullImportRecordId,
      note: '36 evaluations expected with import_record_id NULL after duplicate record delete (ON DELETE SET NULL)',
    },
    remainingBlockers: [
      'Unique indexes not yet applied (deferred)',
      'Re-import not executed',
      'Publish/Discovery not validated',
    ],
  };

  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const failure = {
    capturedAt: new Date().toISOString(),
    outcome: 'ROLLBACK_OR_ABORT',
    reason: message,
  };
  writeFileSync(OUT, JSON.stringify(failure, null, 2));
  console.error(`❌ ${message}`);
  process.exit(1);
});
