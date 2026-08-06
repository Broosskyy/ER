/**
 * Bootshaus final go-live validation — E2E import, idempotency, publish, discovery.
 * Usage: npx tsx scripts/operations/_bootshaus-final-go-live-validation.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';
const OUT_JSON = join(process.cwd(), 'docs/real-data/_bootshaus_final_go_live_validation.json');
const OUT_MD = join(process.cwd(), 'docs/real-data/BOOTSHAUS_FINAL_GO_LIVE_VALIDATION_REPORT.md');

function runScript(script: string) {
  const started = Date.now();
  const r = spawnSync('npx', ['tsx', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    env: process.env,
    timeout: 300_000,
  });
  return {
    exitCode: r.status,
    durationMs: Date.now() - started,
    stdout: r.stdout?.slice(-4000) ?? '',
    stderr: r.stderr?.slice(-2000) ?? '',
  };
}

function anon() {
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function captureMetrics(label: string) {
  const c = getSupabaseServiceClient();

  const { data: importRows, count: importCount } = await c
    .from('import_records')
    .select('id, external_id, status, resulting_event_id, matched_venue_id, matched_organizer_id, matched_city_id, updated_at', { count: 'exact' })
    .eq('source_id', BOOTSHAUS_SOURCE);

  const { data: reviewRows, count: reviewCount } = await c
    .from('import_review_queue')
    .select('id, external_event_id, status, decision, quality_score, trust_score, import_record_id', { count: 'exact' })
    .eq('source_id', BOOTSHAUS_SOURCE);

  const activeReviews = (reviewRows ?? []).filter((r) => r.status === 'pending' || r.status === 'on_hold');
  const uniqueExternalIds = new Set((importRows ?? []).map((r) => r.external_id));
  const uniqueExternalEventIds = new Set(activeReviews.map((r) => r.external_event_id));

  const { count: publishedCount } = await c
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE)
    .eq('status', 'published');

  const { count: sourceRefCount } = await c
    .from('event_source_references')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE);

  const { data: latestJob } = await c
    .from('import_jobs')
    .select('*')
    .eq('source_id', BOOTSHAUS_SOURCE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: source } = await c
    .from('sources')
    .select('source_config, publish_mode, trust_score')
    .eq('id', BOOTSHAUS_SOURCE)
    .maybeSingle();

  const publishedEvents = publishedCount
    ? await c
        .from('events')
        .select('id, title, status, venue_name, organizer_name, venue_id, search_document, trust_score, start_date')
        .eq('source_id', BOOTSHAUS_SOURCE)
        .eq('status', 'published')
        .order('start_date', { ascending: true })
        .limit(10)
    : { data: [] };

  return {
    label,
    capturedAt: new Date().toISOString(),
    importRecords: importCount ?? 0,
    reviewEntries: reviewCount ?? 0,
    activeReviews: activeReviews.length,
    uniqueExternalIds: uniqueExternalIds.size,
    uniqueExternalEventIds: uniqueExternalEventIds.size,
    duplicateSurplus: (importCount ?? 0) - uniqueExternalIds.size,
    publishedEvents: publishedCount ?? 0,
    sourceReferences: sourceRefCount ?? 0,
    latestJob,
    defaultsVenueId: (source?.source_config as { defaults?: { venueId?: string } })?.defaults?.venueId ?? null,
    reviewSample: activeReviews.slice(0, 3).map((r) => ({
      id: r.id,
      status: r.status,
      decision: r.decision,
      quality_score: r.quality_score,
      trust_score: r.trust_score,
    })),
    publishedSample: publishedEvents.data ?? [],
    importRecordIds: (importRows ?? []).map((r) => r.id),
    reviewIds: (reviewRows ?? []).map((r) => r.id),
  };
}

async function runImport(label: string) {
  const c = getSupabaseServiceClient();
  const now = new Date().toISOString();

  await c
    .from('import_jobs')
    .update({
      status: 'failed',
      finished_at: now,
      error_summary: `final-go-live ${label}: superseded pending job`,
    })
    .eq('source_id', BOOTSHAUS_SOURCE)
    .eq('status', 'pending');

  await c.from('sources').update({ next_scheduled_at: now }).eq('id', BOOTSHAUS_SOURCE);

  const scheduler = runScript('scripts/operations/run-scheduler-tick.ts');
  const worker = runScript('scripts/operations/run-queue-worker.ts');

  let recovery = null as ReturnType<typeof runScript> | null;
  let workerRetry = null as ReturnType<typeof runScript> | null;

  const { data: queueRows } = await c
    .from('import_job_queue')
    .select('id, status')
    .eq('source_id', BOOTSHAUS_SOURCE)
    .order('enqueued_at', { ascending: false })
    .limit(5);

  const stuck = (queueRows ?? []).some((q) => ['processing', 'failed'].includes(String(q.status)));
  if (stuck) {
    recovery = runScript('scripts/operations/run-worker-recovery.ts');
    workerRetry = runScript('scripts/operations/run-queue-worker.ts');
  }

  const { data: job } = await c
    .from('import_jobs')
    .select('*')
    .eq('source_id', BOOTSHAUS_SOURCE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { label, scheduler, worker, recovery, workerRetry, latestJob: job, queue: queueRows ?? [] };
}

async function discoveryCheck() {
  const c = getSupabaseServiceClient();
  const a = anon();

  const { data: published } = await c
    .from('events')
    .select('id, title, status, venue_name, search_document, start_date')
    .eq('source_id', BOOTSHAUS_SOURCE)
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(20);

  const ids = (published ?? []).map((e) => e.id);

  const searchTitle = await a
    .from('events')
    .select('id, title, status, venue_name')
    .eq('status', 'published')
    .ilike('title', '%bootshaus%')
    .limit(10);

  const searchVenue = await a
    .from('events')
    .select('id, title, status, venue_name')
    .eq('status', 'published')
    .ilike('venue_name', '%Bootshaus%')
    .limit(10);

  const detail = ids.length
    ? await a.from('events').select('id, title, status, venue_name, organizer_name, event_url, ticket_url, image_url, start_date, search_document').eq('id', ids[0]).maybeSingle()
    : { data: null, error: null };

  return {
    publishedBootshausCount: published?.length ?? 0,
    searchDocumentPopulated: (published ?? []).filter((e) => e.search_document != null).length,
    searchDocumentNull: (published ?? []).filter((e) => e.search_document == null).length,
    anonSearchByTitle: searchTitle.data?.length ?? 0,
    anonSearchByVenue: searchVenue.data?.length ?? 0,
    anonSearchTitleError: searchTitle.error?.message ?? null,
    detailEvent: detail.data ?? null,
    detailError: detail.error?.message ?? null,
    publishedSample: (published ?? []).slice(0, 5),
  };
}

function delta(before: Awaited<ReturnType<typeof captureMetrics>>, after: Awaited<ReturnType<typeof captureMetrics>>) {
  const newImportIds = after.importRecordIds.filter((id) => !before.importRecordIds.includes(id));
  const newReviewIds = after.reviewIds.filter((id) => !before.reviewIds.includes(id));
  return {
    importRecordsDelta: after.importRecords - before.importRecords,
    reviewEntriesDelta: after.reviewEntries - before.reviewEntries,
    publishedDelta: after.publishedEvents - before.publishedEvents,
    newImportRecordIds: newImportIds,
    newReviewIds,
    duplicateSurplusAfter: after.duplicateSurplus,
  };
}

function buildVerdict(report: Record<string, unknown>): { verdict: 'GO' | 'NO GO'; reasons: string[] } {
  const reasons: string[] = [];
  const phase1 = report.phase1 as Record<string, unknown>;
  const phase2 = report.phase2 as Record<string, unknown>;
  const phase3 = report.phase3 as Record<string, unknown>;
  const phase4 = report.phase4 as Record<string, unknown>;

  const job1 = (phase1?.run as { latestJob?: Record<string, unknown> })?.latestJob;
  const job1Ok = job1 && ['completed', 'completed_with_warnings'].includes(String(job1.status));
  if (!job1Ok) reasons.push('Import run 1 did not complete successfully');
  if (Number(job1?.fetched_count ?? 0) <= 0) reasons.push('Import run 1 fetched 0 events');

  const idem = phase2 as { newImportRecordIds?: string[]; newReviewIds?: string[]; duplicateSurplusAfter?: number };
  if ((idem.newImportRecordIds?.length ?? 0) > 0) reasons.push('Import run 2 created new import records');
  if ((idem.newReviewIds?.length ?? 0) > 0) reasons.push('Import run 2 created new reviews');
  if ((idem.duplicateSurplusAfter ?? 0) > 0) reasons.push('Duplicate surplus after run 2');

  const published = Number((phase3 as { publishedEvents?: number })?.publishedEvents ?? 0);
  if (published === 0) reasons.push('No published Bootshaus events after import');

  const discovery = phase4 as { publishedBootshausCount?: number; anonSearchByTitle?: number };
  if ((discovery.publishedBootshausCount ?? 0) === 0) reasons.push('Discovery: no published Bootshaus events visible');
  if ((discovery.anonSearchByTitle ?? 0) === 0 && published > 0) reasons.push('Discovery: anon search returned 0 results');

  return { verdict: reasons.length === 0 ? 'GO' : 'NO GO', reasons };
}

function writeMarkdown(report: Record<string, unknown>, verdict: ReturnType<typeof buildVerdict>) {
  const md = `# Bootshaus Final Go-Live Validation Report

**Date:** ${report.completedAt}  
**Source:** \`source-bootshaus-koeln\`  
**Verdict:** **${verdict.verdict}**

## Phase 1 — First Import

${JSON.stringify(report.phase1, null, 2)}

## Phase 2 — Idempotency (Second Import)

${JSON.stringify(report.phase2, null, 2)}

## Phase 3 — Publish

${JSON.stringify(report.phase3, null, 2)}

## Phase 4 — Discovery

${JSON.stringify(report.phase4, null, 2)}

## Verdict Reasons

${verdict.reasons.length ? verdict.reasons.map((r) => `- ${r}`).join('\n') : '- All checks passed'}

${verdict.verdict === 'GO' ? `## Remaining tasks before Affenkäfig

- Deploy external cron for scheduler + worker
- Apply unique indexes migration (deferred)
- Monitor first scheduled 6h run
- Optional: rename staging-seed city ID to canonical koeln` : ''}
`;
  writeFileSync(OUT_MD, md);
}

async function main() {
  await initializeEntityAliasStore();
  const report: Record<string, unknown> = { startedAt: new Date().toISOString() };

  console.log('==> Baseline');
  const baseline = await captureMetrics('baseline');
  report.baseline = baseline;
  console.log(JSON.stringify(baseline, null, 2));

  if (baseline.importRecords !== 36 || baseline.activeReviews !== 36 || baseline.duplicateSurplus !== 0) {
    throw new Error(
      `Baseline mismatch: records=${baseline.importRecords} reviews=${baseline.activeReviews} surplus=${baseline.duplicateSurplus}`,
    );
  }

  console.log('==> Phase 1: First import');
  const run1 = await runImport('run-1');
  const afterRun1 = await captureMetrics('after-run-1');
  const delta1 = delta(baseline, afterRun1);
  report.phase1 = {
    run: run1,
    after: afterRun1,
    delta: delta1,
    fetchSuccessful: Number(run1.latestJob?.fetched_count ?? 0) > 0,
    parserSuccessful: Number(run1.latestJob?.parsed_count ?? 0) > 0,
    eventsFound: run1.latestJob?.fetched_count ?? 0,
    newImportRecords: delta1.newImportRecordIds.length,
    newReviews: delta1.newReviewIds.length,
    skippedDuplicates: run1.latestJob?.duplicate_count ?? 0,
    errors: run1.latestJob?.error_summary ?? null,
  };
  console.log(JSON.stringify(report.phase1, null, 2));

  console.log('==> Phase 2: Second import (idempotency)');
  const beforeRun2 = afterRun1;
  const run2 = await runImport('run-2');
  const afterRun2 = await captureMetrics('after-run-2');
  const delta2 = delta(beforeRun2, afterRun2);
  report.phase2 = {
    run: run2,
    after: afterRun2,
    ...delta2,
    idempotent:
      delta2.newImportRecordIds.length === 0 &&
      delta2.newReviewIds.length === 0 &&
      delta2.duplicateSurplusAfter === 0,
    jobUpdatedCount: run2.latestJob?.updated_count ?? 0,
    jobCreatedCount: run2.latestJob?.created_count ?? 0,
  };
  console.log(JSON.stringify(report.phase2, null, 2));

  console.log('==> Phase 3: Publish verification');
  report.phase3 = {
    publishedEvents: afterRun2.publishedEvents,
    sourceReferences: afterRun2.sourceReferences,
    publishErrors: run1.latestJob?.error_summary ?? run2.latestJob?.error_summary ?? null,
    latestJobMetrics: {
      run1: {
        created_count: run1.latestJob?.created_count,
        updated_count: run1.latestJob?.updated_count,
        duplicate_count: run1.latestJob?.duplicate_count,
        invalid_count: run1.latestJob?.invalid_count,
      },
      run2: {
        created_count: run2.latestJob?.created_count,
        updated_count: run2.latestJob?.updated_count,
        duplicate_count: run2.latestJob?.duplicate_count,
      },
    },
    reviewSample: afterRun2.reviewSample,
    publishedSample: afterRun2.publishedSample,
    defaultsVenueId: afterRun2.defaultsVenueId,
  };
  console.log(JSON.stringify(report.phase3, null, 2));

  console.log('==> Phase 4: Discovery');
  report.phase4 = await discoveryCheck();
  console.log(JSON.stringify(report.phase4, null, 2));

  const restoreAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  await getSupabaseServiceClient()
    .from('sources')
    .update({ next_scheduled_at: restoreAt })
    .eq('id', BOOTSHAUS_SOURCE);

  report.completedAt = new Date().toISOString();
  report.restoredNextScheduledAt = restoreAt;
  const verdict = buildVerdict(report);
  report.verdict = verdict;

  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  writeMarkdown(report, verdict);

  console.log(`\n=== VERDICT: ${verdict.verdict} ===`);
  if (verdict.reasons.length) console.log(verdict.reasons.join('\n'));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
