/**
 * Phase 4.6.2 — Production activation: migration deploy, controlled two-pass re-import,
 * live metrics, cache refresh, trace audit.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase462-production-activation.ts [phase]
 *
 * Phases: pre-check | migrate | post-verify | pass1 | pass2 | metrics | cache | trace | full
 */
import './bootstrap-ops-supabase';

/** Production activation requires field-trust merge semantics. */
process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import type { SourceRecord } from '@/data/types/records';
import type { ImportJob } from '@/features/import/models/types';

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    adminSourceRepository: registry.adminSourceRepository,
    eventRepository: registry.eventRepository,
    importAggregationService: registry.importAggregationService,
    importEventPublishService: registry.importEventPublishService,
    importRecordRepository: registry.importRecordRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function republishImportedJobRecords(source: SourceRecord, jobId: string): Promise<number> {
  const { importRecordRepository, importEventPublishService } = await loadRegistry();
  const records = await importRecordRepository.listByJobId(jobId);
  let republished = 0;
  for (const record of records) {
    if (!record.resultingEventId) {
      continue;
    }
    await importEventPublishService.publishRecord(record, source, [], { actorId: 'phase462-activation' });
    republished += 1;
  }
  return republished;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATION_FILE = '20260802100000_phase462_publish_fields_and_ticket_phases.sql';
const MIGRATION_PATH = join(ROOT, 'supabase/migrations', MIGRATION_FILE);
const PREFLIGHT_PATH = join(ROOT, 'docs/real-data/_phase462_production_preflight.json');
const OUT_JSON = join(ROOT, 'docs/real-data/_phase462_production_activation.json');
const OUT_MD = join(ROOT, 'docs/PHASE_462_PRODUCTION_ACTIVATION_REPORT.md');

const PHASE462_EVENT_COLUMNS = [
  'venue_address',
  'venue_postal_code',
  'venue_country_code',
  'latitude',
  'longitude',
  'age_restriction',
  'ticket_status',
  'ticket_phases',
  'genre_labels',
] as const;

/** Ordered re-import batch (matches preflight recommendation). */
const REIMPORT_SOURCE_ORDER: string[] = [
  'source-bootshaus-koeln',
  'source-affenkaefig',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-technodampfer',
  'source-ticket-io-protontheclub',
  'source-ticket-io-area51events',
  'source-ticket-io-hmg-concerts',
  'source-bootshaus-ticket-io',
  'source-affenkaefig-ticket-kings',
  'source-ticket-kings-org-elektrokuche',
  'source-ticket-kings-org-underland',
];

type ActivationReport = Record<string, unknown>;

const report: ActivationReport = existsSync(OUT_JSON)
  ? { ...JSON.parse(readFileSync(OUT_JSON, 'utf8')), ...{
      startedAt: new Date().toISOString(),
      phase: process.argv[2] ?? 'full',
      errors: [] as string[],
    }}
  : {
      startedAt: new Date().toISOString(),
      phase: process.argv[2] ?? 'full',
      errors: [] as string[],
    };

function save(): void {
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
}

function fail(message: string): void {
  (report.errors as string[]).push(message);
  save();
  throw new Error(message);
}

function supabaseHost(): string {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function client() {
  return getSupabaseServiceClient();
}

async function loadProductionSource(sourceId: string): Promise<SourceRecord | null> {
  const { data, error } = await client().from('sources').select('*').eq('id', sourceId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapSourceRowToRecord(data as SourceRow);
}

async function probeColumn(table: string, column: string): Promise<boolean> {
  const { error } = await client().from(table).select(column).limit(1);
  return !error;
}

async function migrationApplied(): Promise<boolean> {
  const results = await Promise.all(
    PHASE462_EVENT_COLUMNS.map((col) => probeColumn('events', col)),
  );
  return results.every(Boolean);
}

async function collectCounts(label: string) {
  const c = client();
  const [
    published,
    archived,
    origins,
    importRecords,
    eventArtists,
    withDescription,
    withLineup,
    withTicketPhases,
    withPriceText,
    withAge,
    withCoords,
    withVenueAddress,
    withGenreLabels,
  ] = await Promise.all([
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
    c.from('event_source_references').select('*', { count: 'exact', head: true }).eq('active', true),
    c.from('import_records').select('*', { count: 'exact', head: true }),
    c.from('event_artists').select('*', { count: 'exact', head: true }),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published').neq('description', ''),
    c
      .from('event_artists')
      .select('event_id')
      .then(async () => {
        const { data } = await c.from('event_artists').select('event_id');
        return { count: new Set((data ?? []).map((r) => r.event_id)).size };
      }),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published').not('ticket_phases', 'is', null),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published').not('price_text', 'is', null),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published').not('age_restriction', 'is', null),
    c
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published').not('venue_address', 'is', null),
    c.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published').not('genre_labels', 'is', null),
  ]);

  const snapshot = {
    label,
    capturedAt: new Date().toISOString(),
    publishedEvents: published.count ?? 0,
    archivedEvents: archived.count ?? 0,
    activeOrigins: origins.count ?? 0,
    importRecords: importRecords.count ?? 0,
    eventArtistRows: eventArtists.count ?? 0,
    eventsWithLineup: withLineup.count ?? 0,
    eventsWithMeaningfulDescription: withDescription.count ?? 0,
    eventsWithTicketPhases: withTicketPhases.count ?? 0,
    eventsWithPriceText: withPriceText.count ?? 0,
    eventsWithAgeRestriction: withAge.count ?? 0,
    eventsWithCoordinates: withCoords.count ?? 0,
    eventsWithVenueAddress: withVenueAddress.count ?? 0,
    eventsWithGenreLabels: withGenreLabels.count ?? 0,
  };

  const metrics = (report.metrics as Record<string, unknown>) ?? {};
  metrics[label] = snapshot;
  report.metrics = metrics;
  save();
  return snapshot;
}

async function preDeploymentSafety(): Promise<void> {
  const checks: Record<string, unknown> = {
    targetHost: supabaseHost(),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    genericSourceFieldTrustMerge: process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE === 'true',
    migrationAlreadyApplied: await migrationApplied(),
  };

  if (process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE !== 'true') {
    fail('EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE is not true — aborting.');
  }

  if (!existsSync(PREFLIGHT_PATH)) {
    fail('Preflight artifact missing — run _phase462-production-preflight.ts first.');
  }
  const preflight = JSON.parse(readFileSync(PREFLIGHT_PATH, 'utf8')) as {
    totals?: { affectedSources?: number; affectedEvents?: number };
    generatedAt?: string;
  };
  checks.preflightGeneratedAt = preflight.generatedAt;
  checks.preflightAffectedSources = preflight.totals?.affectedSources;
  checks.preflightAffectedEvents = preflight.totals?.affectedEvents;

  const c = client();
  const { data: activeJobs } = await c
    .from('import_jobs')
    .select('id,source_id,status')
    .in('status', ['pending', 'running'])
    .in('source_id', REIMPORT_SOURCE_ORDER);
  checks.activeImportJobs = activeJobs ?? [];

  const { data: queueRows } = await c
    .from('import_job_queue')
    .select('id,source_id,status,worker_id')
    .in('status', ['pending', 'processing', 'leased'])
    .in('source_id', REIMPORT_SOURCE_ORDER);
  checks.activeQueueEntries = queueRows ?? [];

  if ((activeJobs ?? []).length > 0 || (queueRows ?? []).length > 0) {
    fail('Active import jobs or queue entries exist for activation sources.');
  }

  const baseline = await collectCounts('baseline');
  checks.baseline = baseline;

  const { data: sources } = await c
    .from('sources')
    .select('id,display_name,source_config,adapter_key,publish_mode,review_required')
    .in('id', REIMPORT_SOURCE_ORDER);
  checks.sourceFingerprints = (sources ?? []).map((s) => ({
    id: s.id,
    publishMode: s.publish_mode,
    adapterKey: s.adapter_key,
    maxDetailPages: (s.source_config as Record<string, unknown>)?.ticketPlatform
      ? (s.source_config as { ticketPlatform?: { limits?: { maxDetailPages?: number } } }).ticketPlatform?.limits
          ?.maxDetailPages
      : (s.source_config as { website?: { limits?: { maxDetailPages?: number } } })?.website?.limits
          ?.maxDetailPages,
  }));

  report.preDeployment = checks;
  save();
  console.log(JSON.stringify(checks, null, 2));
}

async function deployMigration(): Promise<void> {
  if (await migrationApplied()) {
    report.migration = { status: 'already_applied', file: MIGRATION_FILE };
    save();
    console.log('Migration columns already present.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    fail('DATABASE_URL / SUPABASE_DB_URL required to apply migration.');
  }

  if (!existsSync(MIGRATION_PATH)) {
    fail(`Migration file not found: ${MIGRATION_PATH}`);
  }

  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const pgClient = new pg.Client({ connectionString: databaseUrl });
  await pgClient.connect();
  try {
    await pgClient.query(sql);
  } finally {
    await pgClient.end();
  }

  const applied = await migrationApplied();
  report.migration = {
    status: applied ? 'applied' : 'failed_verification',
    file: MIGRATION_FILE,
    columnsVerified: applied,
  };
  save();
  if (!applied) {
    fail('Migration applied but column probes failed.');
  }
  console.log('Migration applied and verified.');
}

async function postMigrationVerify(): Promise<void> {
  const columnProbes: Record<string, boolean> = {};
  for (const col of PHASE462_EVENT_COLUMNS) {
    columnProbes[col] = await probeColumn('events', col);
  }

  const afterMigrate = await collectCounts('post_migration');
  const metrics = report.metrics as Record<string, Record<string, number>> | undefined;
  const baseline = metrics?.baseline;
  const drift =
    baseline != null &&
    (afterMigrate.publishedEvents !== baseline.publishedEvents ||
      afterMigrate.activeOrigins !== baseline.activeOrigins);

  report.postMigration = {
    columnProbes,
    counts: afterMigrate,
    canonicalCountStable: baseline == null ? true : !drift,
    publicRepositoryLoads: true,
  };

  try {
    const { data, error } = await client()
      .from('events')
      .select('id,title')
      .eq('status', 'published')
      .limit(5);
    if (error) {
      throw new Error(error.message);
    }
    report.postMigration.sampleEventLoad = (data ?? []).length > 0;
    report.postMigration.sampleTitles = (data ?? []).map((row) => row.title);
  } catch (error) {
    report.postMigration.publicRepositoryLoads = false;
    report.postMigration.repositoryError = error instanceof Error ? error.message : String(error);
    fail('Public event repository failed after migration.');
  }

  save();
  console.log(JSON.stringify(report.postMigration, null, 2));
}

interface ImportRunResult {
  sourceId: string;
  label: string;
  jobId: string;
  status: string;
  runtimeMs: number;
  metrics: ImportJob['metrics'];
  republishedRecords?: number;
  detailStats: {
    descriptionsInPayload: number;
    lineupsInPayload: number;
    ticketOffersInPayload: number;
    detailPagesFetched: number;
    detailPagesBlocked: number;
  };
}

async function analyzeImportRecords(sourceId: string, jobId: string): Promise<ImportRunResult['detailStats']> {
  const { data } = await client()
    .from('import_records')
    .select('normalized_payload')
    .eq('source_id', sourceId)
    .eq('import_job_id', jobId);

  let descriptionsInPayload = 0;
  let lineupsInPayload = 0;
  let ticketOffersInPayload = 0;
  let detailPagesFetched = 0;
  let detailPagesBlocked = 0;

  for (const row of data ?? []) {
    const payload = row.normalized_payload as Record<string, unknown> | undefined;
    if (!payload) continue;
    if (typeof payload.description === 'string' && payload.description.trim().length > 40) {
      descriptionsInPayload += 1;
    }
    if (Array.isArray(payload.artistNames) && payload.artistNames.length > 0) {
      lineupsInPayload += 1;
    }
    const meta = payload.sourceMetadata as Record<string, unknown> | undefined;
    if (Array.isArray(meta?.ticketOffers) && meta.ticketOffers.length > 0) {
      ticketOffersInPayload += 1;
    }
    const detail = meta?.detailEnrichment as Record<string, unknown> | undefined;
    if (typeof detail?.pagesFetched === 'number') {
      detailPagesFetched = Math.max(detailPagesFetched, detail.pagesFetched as number);
    }
    if (detail?.blockedByPow === true) {
      detailPagesBlocked += 1;
    }
  }

  return {
    descriptionsInPayload,
    lineupsInPayload,
    ticketOffersInPayload,
    detailPagesFetched,
    detailPagesBlocked,
  };
}

async function runSourceImport(source: SourceRecord, label: string): Promise<ImportRunResult> {
  const started = Date.now();
  const { importAggregationService } = await loadRegistry();
  const job = await importAggregationService.enqueueJob(source, 'manual', `phase462:${label}`);
  const completed = await importAggregationService.executeExistingJob(job, source, {
    recordImportReputation: true,
  });
  const detailStats = await analyzeImportRecords(source.id, completed.id);
  let republishedRecords = 0;
  if (source.publishMode === 'manual_review' || source.reviewRequired) {
    republishedRecords = await republishImportedJobRecords(source, completed.id);
  }
  return {
    sourceId: source.id,
    label,
    jobId: completed.id,
    status: completed.status,
    runtimeMs: Date.now() - started,
    metrics: completed.metrics,
    republishedRecords,
    detailStats,
  };
}

async function runPass(passLabel: 'pass1' | 'pass2'): Promise<void> {
  const {
    importAggregationService,
    initializeEntityAliasStore,
    flushEntityAliasStore,
  } = await loadRegistry();
  await initializeEntityAliasStore();
  const results: ImportRunResult[] = [];

  for (const sourceId of REIMPORT_SOURCE_ORDER) {
    const source = await loadProductionSource(sourceId);
    if (!source) {
      (report.errors as string[]).push(`Source missing: ${sourceId}`);
      continue;
    }
    if (!source.enabled || source.archived) {
      results.push({
        sourceId,
        label: `${passLabel}:skipped-inactive`,
        jobId: '',
        status: 'skipped',
        runtimeMs: 0,
        metrics: {
          fetchedCount: 0,
          parsedCount: 0,
          invalidCount: 0,
          warningCount: 0,
          errorCount: 0,
          createdCount: 0,
          updatedCount: 0,
          duplicateCount: 0,
        },
        detailStats: {
          descriptionsInPayload: 0,
          lineupsInPayload: 0,
          ticketOffersInPayload: 0,
          detailPagesFetched: 0,
          detailPagesBlocked: 0,
        },
      });
      continue;
    }

    console.log(`[${passLabel}] Importing ${sourceId}...`);
    const result = await runSourceImport(source, `${passLabel}:${sourceId}`);
    results.push(result);
    console.log(
      JSON.stringify({
        sourceId,
        status: result.status,
        metrics: result.metrics,
        detailStats: result.detailStats,
      }),
    );
  }

  if (results.length === 0) {
    fail(`No sources imported in ${passLabel} — verify EXPO_PUBLIC_USE_SUPABASE=true.`);
  }

  await flushEntityAliasStore();
  report[passLabel] = { completedAt: new Date().toISOString(), results };
  await collectCounts(passLabel);
  save();
}

async function refreshCaches(): Promise<void> {
  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  report.cacheRefresh = { completedAt: new Date().toISOString(), ok: true };
  save();
}

async function runTraceAudit(): Promise<void> {
  const { toEventDisplayModel } = await import('@/features/events/formatting/display-event');
  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  const events = await eventRepository.getPublishedEvents();
  const needles = [
    'Sommerfest',
    'PLAY!',
    'Affenk',
    'Musik die mich antreibt',
    'Technodampfer',
    'SHOCKONE',
    'Lehmann',
    'Proton',
    'Area51',
    'HMG',
    'Mallorca',
  ];

  const traces = events
    .filter((event) => needles.some((n) => event.title.toLowerCase().includes(n.toLowerCase())))
    .map((event) => {
      const display = toEventDisplayModel(event);
      return {
        eventId: event.id,
        title: event.title,
        source: event.source,
        canonicalFields: {
          descriptionLen: event.description?.length ?? 0,
          artists: event.artists?.length ?? 0,
          lineup: event.lineup?.length ?? 0,
          ticketPhases: event.ticketPhases?.length ?? 0,
          priceText: event.priceText,
          displayPriceText: display.displayPriceText,
          latitude: event.latitude,
          longitude: event.longitude,
          address: event.address,
          ageRestriction: event.ageRestriction,
          ticketStatus: event.ticketStatus,
        },
        projection: {
          knownArtistNames: display.knownArtistNames.length,
          genres: display.genres.length,
          ticketAvailability: display.ticketAvailability,
          isSoldOut: display.isSoldOut,
        },
        ticketPhaseSample: event.ticketPhases?.slice(0, 3),
      };
    });

  report.traceAudit = { generatedAt: new Date().toISOString(), traces };
  writeFileSync(
    join(ROOT, 'docs/real-data/_phase462_post_activation_trace.json'),
    JSON.stringify(report.traceAudit, null, 2),
  );
  save();
}

function buildMarkdown(): void {
  const metrics = report.metrics as Record<string, Record<string, number>> | undefined;
  const baseline = metrics?.baseline;
  const pass1 = metrics?.pass1;
  const pass2 = metrics?.pass2;
  const pre = report.preDeployment as Record<string, unknown> | undefined;
  const mig = report.migration as Record<string, unknown> | undefined;

  const md = [
    '# Phase 4.6.2 Production Activation Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Pre-deployment safety',
    `- Target: ${pre?.targetHost ?? 'n/a'}`,
    `- Field-trust merge: ${pre?.genericSourceFieldTrustMerge}`,
    `- Preflight events: ${pre?.preflightAffectedEvents}`,
    '',
    '## 2. Migration',
    `- Status: ${mig?.status ?? 'not run'}`,
    `- File: ${MIGRATION_FILE}`,
    '',
    '## 3. Counts (baseline → pass1 → pass2)',
    `| Metric | Baseline | Pass 1 | Pass 2 |`,
    `| Published | ${baseline?.publishedEvents ?? '-'} | ${pass1?.publishedEvents ?? '-'} | ${pass2?.publishedEvents ?? '-'} |`,
    `| Origins | ${baseline?.activeOrigins ?? '-'} | ${pass1?.activeOrigins ?? '-'} | ${pass2?.activeOrigins ?? '-'} |`,
    `| Ticket phases | ${baseline?.eventsWithTicketPhases ?? '-'} | ${pass1?.eventsWithTicketPhases ?? '-'} | ${pass2?.eventsWithTicketPhases ?? '-'} |`,
    `| Lineups | ${baseline?.eventsWithLineup ?? '-'} | ${pass1?.eventsWithLineup ?? '-'} | ${pass2?.eventsWithLineup ?? '-'} |`,
    `| Descriptions | ${baseline?.eventsWithMeaningfulDescription ?? '-'} | ${pass1?.eventsWithMeaningfulDescription ?? '-'} | ${pass2?.eventsWithMeaningfulDescription ?? '-'} |`,
    '',
    '## 4. Go/no-go for Part 3 manual acceptance',
    'See JSON artifact for per-source pass metrics and trace audit.',
    '',
    `Full JSON: docs/real-data/_phase462_production_activation.json`,
  ].join('\n');

  writeFileSync(OUT_MD, md);
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';

  if (phase === 'pre-check' || phase === 'full') {
    await preDeploymentSafety();
  }
  if (phase === 'migrate' || phase === 'full') {
    await deployMigration();
  }
  if (phase === 'post-verify' || phase === 'full') {
    await postMigrationVerify();
  }
  if (phase === 'pass1' || phase === 'full') {
    await runPass('pass1');
    await refreshCaches();
  }
  if (phase === 'pass2' || phase === 'full') {
    await runPass('pass2');
    await refreshCaches();
  }
  if (phase === 'metrics' || phase === 'full') {
    await collectCounts('final');
  }
  if (phase === 'trace' || phase === 'full') {
    await runTraceAudit();
  }
  if (phase === 'cache') {
    await refreshCaches();
  }

  report.completedAt = new Date().toISOString();
  buildMarkdown();
  save();
  console.log(`Activation report: ${OUT_JSON}`);
}

main().catch((error) => {
  console.error(error);
  save();
  process.exit(1);
});
