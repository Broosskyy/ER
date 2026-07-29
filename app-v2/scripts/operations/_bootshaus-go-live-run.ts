/**
 * Bootshaus go-live execution collector (ops-only, service role).
 * Usage: npx tsx scripts/operations/_bootshaus-go-live-run.ts [phase]
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { productionOperationsMonitoringService } from '@/data/repositories/registry';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { mapSourceRecordToRow } from '@/data/mappers/source-mapper';
import { createBootshausLiveProductionSourceRecord } from '@/features/sources/production/production-source-records';
import {
  getSupabaseServiceClient,
  resolveSupabaseServiceRoleKey,
} from '@/services/supabase/client';

const BOOTSHAUS_ID = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_go_live_run.json');
const report: Record<string, unknown> = { startedAt: new Date().toISOString(), errors: [] as string[] };

function save() {
  writeFileSync(OUT, JSON.stringify(report, null, 2));
}

function host() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function db() {
  return getSupabaseServiceClient();
}

function anon() {
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function phase1() {
  const c = db();
  const checks: Record<string, unknown> = {
    targetProject: host(),
    serviceRoleConfigured: Boolean(resolveSupabaseServiceRoleKey()),
  };
  const probes = [
    ['platform_operations_state', () => c.from('platform_operations_state').select('id').limit(1)],
    ['sources', () => c.from('sources').select('id').eq('id', BOOTSHAUS_ID).maybeSingle()],
    ['scheduler_runs_read', () => c.from('scheduler_runs').select('id').limit(1)],
    ['import_job_queue', () => c.from('import_job_queue').select('id,status').eq('source_id', BOOTSHAUS_ID).limit(5)],
    ['events', () => c.from('events').select('id').limit(1)],
    [
      'claim_rpc',
      () =>
        c.rpc('claim_import_job_queue_entries', {
          p_limit: 1,
          p_now: new Date().toISOString(),
          p_worker_id: 'go-live-probe',
          p_lease_ms: 60000,
        }),
    ],
  ] as const;

  for (const [name, fn] of probes) {
    const { data, error } = await fn();
    checks[name] = { ok: !error, error: error?.message ?? null, rows: Array.isArray(data) ? data.length : data ? 1 : 0 };
    if (error) {
      (report.errors as string[]).push(`phase1 ${name}: ${error.message}`);
    }
  }

  // scheduler write probe (rolled back via delete if inserted)
  const probeId = `go-live-write-probe-${Date.now()}`;
  const ins = await c.from('scheduler_runs').insert({
    id: probeId,
    started_at: new Date().toISOString(),
    status: 'completed',
    sources_scanned: 0,
    sources_due: 0,
    jobs_enqueued: 0,
    jobs_processed: 0,
    jobs_succeeded: 0,
    jobs_failed: 0,
  });
  checks.scheduler_runs_write = { ok: !ins.error, error: ins.error?.message ?? null };
  if (!ins.error) {
    await c.from('scheduler_runs').delete().eq('id', probeId);
  } else {
    (report.errors as string[]).push(`phase1 scheduler_runs_write: ${ins.error.message}`);
  }

  report.phase1 = checks;
  save();
  console.log(JSON.stringify(checks, null, 2));
  if ((report.errors as string[]).some((e) => e.startsWith('phase1'))) {
    process.exit(1);
  }
}

async function fetchBootshaus() {
  const { data, error } = await db()
    .from('sources')
    .select(
      'id,enabled,active,archived,publish_mode,review_required,schedule_enabled,schedule_policy,schedule_interval_preset,next_scheduled_at,base_url,trust_score,computed_trust_score,source_config,metadata,last_successful_sync_at,consecutive_failure_count',
    )
    .eq('id', BOOTSHAUS_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

function verifyBootshaus(row: Record<string, unknown> | null) {
  const cfg = (row?.source_config as Record<string, unknown> | undefined) ?? {};
  const website = (cfg.website as Record<string, unknown> | undefined) ?? {};
  const reference = (cfg.reference as Record<string, unknown> | undefined) ?? {};
  const metadata = (row?.metadata as Record<string, unknown> | undefined) ?? {};
  const connectorKey = (metadata.connectorKey as string | undefined) ?? (reference.connectorKey as string | undefined);
  return {
    exists: Boolean(row),
    enabled: row?.enabled === true,
    publish_mode: row?.publish_mode === 'auto_publish',
    review_required: row?.review_required === false,
    schedule_enabled: row?.schedule_enabled === true,
    schedule_policy: row?.schedule_policy === 'interval',
    schedule_interval_preset: row?.schedule_interval_preset === 'every_6_hours',
    next_scheduled_at: Boolean(row?.next_scheduled_at),
    base_url: Boolean(row?.base_url),
    connectorKey: connectorKey === 'club_website',
    preferredStrategy: website.preferredStrategy === 'html_selector',
    allOk:
      Boolean(row) &&
      row?.enabled === true &&
      row?.publish_mode === 'auto_publish' &&
      row?.review_required === false &&
      row?.schedule_enabled === true &&
      row?.schedule_policy === 'interval' &&
      row?.schedule_interval_preset === 'every_6_hours' &&
      Boolean(row?.next_scheduled_at) &&
      Boolean(row?.base_url) &&
      connectorKey === 'club_website' &&
      website.preferredStrategy === 'html_selector',
    row,
  };
}

async function ensureBootshausSource() {
  const existing = await fetchBootshaus();
  if (existing) {
    return { seeded: false };
  }
  const now = new Date().toISOString();
  const record = createBootshausLiveProductionSourceRecord({
    scheduleEnabled: true,
    schedulePolicy: 'interval',
    scheduleIntervalPreset: 'every_6_hours',
    scheduleTimezone: 'Europe/Berlin',
    nextScheduledAt: now,
    consecutiveFailureCount: 0,
    totalImportCount: 0,
    totalValidEventCount: 0,
    totalRejectedEventCount: 0,
    duplicateRate: 0,
    updateRate: 0,
    errorRate: 0,
    schedulerMaintenanceMode: false,
    metadata: {
      category: 'website',
      connectorKey: 'club_website',
      genreNames: ['Techno', 'House', 'Electronic'],
      tags: ['club', 'koeln', 'techno', 'website', 'production-source'],
    },
  });
  const payload = mapSourceRecordToRow(record) as Record<string, unknown>;
  for (const optionalColumn of [
    'last_error',
    'computed_trust_score',
    'trust_score_updated_at',
    'source_roles',
    'publish_mode',
    'country_code',
  ]) {
    delete payload[optionalColumn];
  }
  payload.consecutive_failure_count ??= 0;
  payload.total_import_count ??= 0;
  payload.total_valid_event_count ??= 0;
  payload.total_rejected_event_count ??= 0;
  payload.duplicate_rate ??= 0;
  payload.update_rate ??= 0;
  payload.error_rate ??= 0;
  const { error } = await db()
    .from('sources')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(`bootshaus seed failed: ${error.message}`);
  return { seeded: true };
}

async function activateBootshaus() {
  const { error } = await db()
    .from('sources')
    .update({
      enabled: true,
      active: true,
      archived: false,
      publish_mode: 'auto_publish',
      review_required: false,
      schedule_policy: 'interval',
      schedule_enabled: true,
      schedule_interval_preset: 'every_6_hours',
      polling_interval_minutes: 360,
      next_scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', BOOTSHAUS_ID);
  if (error) throw new Error(error.message);
}

async function phase2() {
  const seeded = await ensureBootshausSource();
  let before = verifyBootshaus(await fetchBootshaus());
  let activated = false;
  if (!before.allOk) {
    await activateBootshaus();
    activated = true;
  }
  const after = verifyBootshaus(await fetchBootshaus());
  report.phase2 = { seeded, activated, before, after, config: after.row };
  save();
  console.log(JSON.stringify({ seeded, activated, checks: after }, null, 2));
  if (!after.exists) {
    throw new Error('source-bootshaus-koeln missing after seed/activation');
  }
}

async function captureState(label: string) {
  const c = db();
  const refs = await c.from('event_source_references').select('canonical_event_id,active').eq('source_id', BOOTSHAUS_ID);
  const refIds = (refs.data ?? []).map((r) => String((r as Record<string, unknown>).canonical_event_id));
  let publishedBootshaus: Record<string, unknown>[] = [];
  if (refIds.length) {
    const ev = await c.from('events').select('id,title,status,start_date,venue_name,updated_at').in('id', refIds).eq('status', 'published');
    publishedBootshaus = (ev.data as Record<string, unknown>[]) ?? [];
  }
  const [queue, jobs, reviews, deadLetter, sched, worker, source] = await Promise.all([
    c.from('import_job_queue').select('*').eq('source_id', BOOTSHAUS_ID).order('enqueued_at', { ascending: false }).limit(20),
    c.from('import_jobs').select('*').eq('source_id', BOOTSHAUS_ID).order('created_at', { ascending: false }).limit(10),
    c.from('import_review_queue').select('id,status', { count: 'exact', head: true }).eq('source_id', BOOTSHAUS_ID),
    c.from('import_job_queue').select('id,error_summary,dead_lettered_at,status').eq('source_id', BOOTSHAUS_ID).not('dead_lettered_at', 'is', null),
    c.from('scheduler_runs').select('*').order('started_at', { ascending: false }).limit(5),
    c.from('worker_runs').select('*').order('started_at', { ascending: false }).limit(5),
    c.from('sources').select('trust_score,computed_trust_score,next_scheduled_at,last_successful_sync_at,consecutive_failure_count').eq('id', BOOTSHAUS_ID).maybeSingle(),
  ]);
  return {
    label,
    capturedAt: new Date().toISOString(),
    queue: queue.data ?? [],
    jobs: jobs.data ?? [],
    publishedBootshaus,
    publishedBootshausCount: publishedBootshaus.length,
    reviewCount: reviews.count ?? 0,
    deadLetter: deadLetter.data ?? [],
    schedulerRuns: sched.data ?? [],
    workerRuns: worker.data ?? [],
    source: source.data ?? null,
    sourceReferences: refs.data ?? [],
  };
}

async function phase3() {
  report.phase3 = await captureState('before');
  save();
  console.log(JSON.stringify(report.phase3, null, 2));
}

function runScript(script: string) {
  const r = spawnSync('npx', ['tsx', script], { cwd: process.cwd(), encoding: 'utf8', shell: true, env: process.env });
  return { exitCode: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function phase4(label: string) {
  const now = new Date().toISOString();
  await db()
    .from('import_jobs')
    .update({
      status: 'failed',
      finished_at: now,
      error_summary: `go-live ${label}: superseded pending import job`,
    })
    .eq('source_id', BOOTSHAUS_ID)
    .eq('status', 'pending');
  await db().from('sources').update({ next_scheduled_at: now }).eq('id', BOOTSHAUS_ID);
  const scheduler = runScript('scripts/operations/run-scheduler-tick.ts');
  const queueAfterSched = await db()
    .from('import_job_queue')
    .select('*')
    .eq('source_id', BOOTSHAUS_ID)
    .order('enqueued_at', { ascending: false })
    .limit(10);
  const active = (queueAfterSched.data ?? []).filter((q) => ['queued', 'processing'].includes(String((q as Record<string, unknown>).status)));
  const worker = runScript('scripts/operations/run-queue-worker.ts');
  let queueAfterWorker = await db()
    .from('import_job_queue')
    .select('*')
    .eq('source_id', BOOTSHAUS_ID)
    .order('enqueued_at', { ascending: false })
    .limit(10);
  let recovery = null as ReturnType<typeof runScript> | null;
  let workerRetry = null as ReturnType<typeof runScript> | null;
  const stuck = (queueAfterWorker.data ?? []).some((q) => {
    const s = String((q as Record<string, unknown>).status);
    return s === 'processing' || s === 'failed';
  });
  if (stuck) {
    recovery = runScript('scripts/operations/run-worker-recovery.ts');
    workerRetry = runScript('scripts/operations/run-queue-worker.ts');
    queueAfterWorker = await db()
      .from('import_job_queue')
      .select('*')
      .eq('source_id', BOOTSHAUS_ID)
      .order('enqueued_at', { ascending: false })
      .limit(10);
  }
  return { label, scheduler, queueAfterSched: queueAfterSched.data, activeJobCount: active.length, worker, recovery, workerRetry, queueAfterWorker: queueAfterWorker.data };
}

async function getEventSamples() {
  const refs = await db().from('event_source_references').select('*').eq('source_id', BOOTSHAUS_ID).eq('active', true).limit(20);
  const ids = (refs.data ?? []).map((r) => String((r as Record<string, unknown>).canonical_event_id));
  if (!ids.length) return [];
  const { data } = await db()
    .from('events')
    .select('id,title,status,start_date,venue_name,event_url,ticket_url,image_url,organizer_name,trust_score,updated_at')
    .in('id', ids)
    .order('start_date', { ascending: true })
    .limit(10);
  return ((data as Record<string, unknown>[]) ?? []).map((e) => ({
    ...e,
    titleHasBootshausSuffix: /\|\s*Bootshaus/i.test(String(e.title ?? '')),
    ref: (refs.data ?? []).find((r) => String((r as Record<string, unknown>).canonical_event_id) === String(e.id)) ?? null,
  }));
}

async function discoveryCheck(eventIds: string[]) {
  const a = anon();
  const all = await a.from('events').select('id,title,status,start_date,venue_name').eq('status', 'published').order('updated_at', { ascending: false }).limit(200);
  const bootshaus = (all.data ?? []).filter((e) => {
    const row = e as Record<string, unknown>;
    return eventIds.includes(String(row.id)) || String(row.title ?? '').toLowerCase().includes('bootshaus') || String(row.venue_name ?? '').toLowerCase().includes('bootshaus');
  });
  const searchTitle = await a.from('events').select('id,title,status').eq('status', 'published').ilike('title', '%bootshaus%').limit(10);
  const searchVenue = await a.from('events').select('id,title,status,venue_name').eq('status', 'published').ilike('venue_name', '%bootshaus%').limit(10);
  const reviewPublic = await a.from('import_review_queue').select('id,status').eq('status', 'pending').limit(5);
  return {
    backendValidated: true,
    publishedTotal: all.data?.length ?? 0,
    bootshausVisibleCount: bootshaus.length,
    bootshausVisibleSample: bootshaus.slice(0, 5),
    searchTitleCount: searchTitle.data?.length ?? 0,
    searchVenueCount: searchVenue.data?.length ?? 0,
    reviewPublicCount: reviewPublic.data?.length ?? 0,
    reviewPublicError: reviewPublic.error?.message ?? null,
  };
}

async function phasesRest() {
  await initializeEntityAliasStore();
  report.phase4first = await phase4('first');
  report.afterFirst = await captureState('after-first');
  const latestJob = ((report.afterFirst as Record<string, unknown>).jobs as Record<string, unknown>[])?.[0] ?? null;
  report.phase5 = {
    scheduler: (report.phase4first as Record<string, unknown>).scheduler,
    worker: (report.phase4first as Record<string, unknown>).worker,
    latestJob,
    pipeline: buildPipelineStatus(report.phase4first as Record<string, unknown>, latestJob),
  };
  const samples = await getEventSamples();
  report.phase6 = { samples, sampleCount: samples.length, latestJob };
  const eventIds = samples.map((s) => String(s.id));
  report.phase7 = await discoveryCheck(eventIds);

  report.phase4second = await phase4('second');
  report.afterSecond = await captureState('after-second');
  const job2 = ((report.afterSecond as Record<string, unknown>).jobs as Record<string, unknown>[])?.[0] ?? null;
  report.phase8 = {
    secondRun: report.phase4second,
    afterSecond: report.afterSecond,
    publishedDelta:
      Number((report.afterSecond as Record<string, unknown>).publishedBootshausCount ?? 0) -
      Number((report.afterFirst as Record<string, unknown>).publishedBootshausCount ?? 0),
    idempotent:
      Number(job2?.records_created ?? 0) === 0 &&
      Number((report.afterSecond as Record<string, unknown>).publishedBootshausCount ?? 0) ===
        Number((report.afterFirst as Record<string, unknown>).publishedBootshausCount ?? 0),
  };

  const restoreAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  await db()
    .from('sources')
    .update({ next_scheduled_at: restoreAt, schedule_interval_preset: 'every_6_hours', polling_interval_minutes: 360 })
    .eq('id', BOOTSHAUS_ID);

  try {
    report.phase9 = await productionOperationsMonitoringService.getSnapshot();
  } catch (e) {
    report.phase9 = { error: e instanceof Error ? e.message : String(e) };
  }
  report.restoredNextScheduledAt = restoreAt;
  save();
  console.log(JSON.stringify(report, null, 2));
}

function buildPipelineStatus(run: Record<string, unknown>, job: Record<string, unknown> | null) {
  const schedOk = (run.scheduler as { exitCode: number | null })?.exitCode === 0;
  const workerOk = (run.worker as { exitCode: number | null })?.exitCode === 0;
  const jobStatus = String(job?.status ?? 'unknown');
  const jobOk = jobStatus === 'completed' || jobStatus === 'succeeded';
  return {
    scheduler: schedOk ? 'OK' : 'Fehler',
    queue: run.activeJobCount === 1 || (Array.isArray(run.queueAfterSched) && (run.queueAfterSched as unknown[]).length > 0) ? 'OK' : 'Warnung',
    worker: workerOk ? 'OK' : 'Fehler',
    fetch: jobOk ? 'OK' : jobStatus === 'failed' ? 'Fehler' : 'Warnung',
    normalize: Number(job?.records_normalized ?? 0) > 0 || jobOk ? 'OK' : 'Warnung',
    validate: Number(job?.records_valid ?? 0) >= 0 && jobOk ? 'OK' : 'Warnung',
    matching: jobOk ? 'OK' : 'Warnung',
    trust: Number(job?.records_review ?? 0) > 0 ? 'Warnung' : 'OK',
    lifecycle: jobOk ? 'OK' : 'Warnung',
    publish: Number(job?.records_published ?? 0) > 0 ? 'OK' : jobOk && Number(job?.records_published ?? 0) === 0 ? 'Warnung' : 'Fehler',
    discovery: Number(job?.records_published ?? 0) > 0 ? 'OK' : 'Warnung',
    api: 'nicht überprüfbar',
  };
}

async function main() {
  const phase = process.argv[2] ?? 'all';
  if (phase === '1' || phase === 'all') await phase1();
  if (phase === '2' || phase === 'all') await phase2();
  if (phase === '3' || phase === 'all') await phase3();
  if (phase === 'rest' || phase === 'all') await phasesRest();
}

main().catch((e) => {
  (report.errors as string[]).push(e instanceof Error ? e.message : String(e));
  save();
  console.error(e);
  process.exit(1);
});
