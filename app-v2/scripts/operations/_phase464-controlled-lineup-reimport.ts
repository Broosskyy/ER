/**
 * Phase 4.6.4 — Controlled detail reimport, canonical republish and lineup completion.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase464-controlled-lineup-reimport.ts [phase]
 *
 * Phases:
 *   preflight | gate | backup | pass1 | repair | audit-pass1 | pass2 | audit-final |
 *   multi-origin | flyer-inventory | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { resolveLineupRootCause } from '@/features/aggregation/domain/lineup-root-cause';
import {
  classifyTicketUrl,
  pickBestTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import {
  isLineupPlaceholderArtist,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import {
  assessLineupRepairNeed,
  pickBestImportRecordForLineupRepair,
} from '@/features/import/services/lineup-projection-integrity';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_MATRIX = join(ROOT, 'docs/real-data/_phase464_current_event_matrix.json');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase464_lineup_backup.json');
const OUT_PASS1 = join(ROOT, 'docs/real-data/_phase464_lineup_pass1.json');
const OUT_AFTER_PASS1 = join(ROOT, 'docs/real-data/_phase464_lineup_after_pass1.json');
const OUT_PASS2 = join(ROOT, 'docs/real-data/_phase464_lineup_pass2.json');
const OUT_FINAL_AUDIT = join(ROOT, 'docs/real-data/_phase464_lineup_final_audit.json');
const OUT_FLYER = join(ROOT, 'docs/real-data/_phase464_flyer_only_candidates.json');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase464_controlled_reimport_state.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_464_CONTROLLED_LINEUP_REIMPORT_REPORT.md');

const EXPECTED_PUBLISHED = 108;
const SCHEMA_COLUMNS = ['venue_address', 'ticket_phases', 'genre_labels', 'ticket_status'] as const;

const REIMPORT_SOURCE_ORDER = [
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

const MULTI_ORIGIN_PAIRS: Array<{ label: string; sourceIds: string[] }> = [
  { label: 'Bootshaus', sourceIds: ['source-bootshaus-koeln', 'source-bootshaus-ticket-io'] },
  { label: 'Affenkäfig', sourceIds: ['source-affenkaefig', 'source-affenkaefig-ticket-kings'] },
];

const REPRESENTATIVE_PATTERNS = [
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest\s+elektroküche/i },
  { label: 'MDMA', pattern: /\bmdma\b.*musik die mich antreibt/i },
  { label: 'Bootshaus on a Ship', pattern: /bootshaus\s+on\s+a\s+ship/i },
  { label: 'Vision Ekstase', pattern: /vision\s+ekstase/i },
  { label: '100% SCHRANZ', pattern: /100%\s*schr?anz/i },
  { label: 'PURE TECHNO', pattern: /pure\s+techno/i },
  { label: 'Blacklist Festival', pattern: /blacklist\s+festival/i },
  { label: 'Lehmann reference', pattern: /lehmann/i },
  { label: 'Single-DJ', pattern: /techno\s+dampfer.*w\//i },
];

type AllowedRootCause =
  | 'A_source_no_lineup'
  | 'B_detail_fetch_failed'
  | 'C_detail_fetch_blocked'
  | 'D_parser_limitation'
  | 'E_merge_limitation'
  | 'F_publish_limitation'
  | 'G_projection_limitation'
  | 'H_source_limitation';

type ReportState = Record<string, unknown>;

function loadState(): ReportState {
  return existsSync(OUT_STATE)
    ? (JSON.parse(readFileSync(OUT_STATE, 'utf8')) as ReportState)
    : { startedAt: new Date().toISOString() };
}

const state = loadState();

function saveState(): void {
  writeFileSync(OUT_STATE, JSON.stringify(state, null, 2));
}

function fail(message: string): never {
  const errors = (state.errors as string[]) ?? [];
  errors.push(message);
  state.errors = errors;
  saveState();
  throw new Error(message);
}

function supabaseHost(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function mapToAllowedRootCause(rootCauseClass: string, stage: number | null): AllowedRootCause {
  if (rootCauseClass === 'source_no_lineup' || rootCauseClass === 'list_page_no_lineup') {
    return 'A_source_no_lineup';
  }
  if (rootCauseClass === 'detail_not_fetched' || rootCauseClass === 'detail_fetch_disabled') {
    return 'B_detail_fetch_failed';
  }
  if (rootCauseClass === 'detail_fetch_blocked') return 'C_detail_fetch_blocked';
  if (
    rootCauseClass === 'parser_format_unsupported' ||
    rootCauseClass === 'parser_invalid_extraction' ||
    rootCauseClass === 'description_lineup_unparsed'
  ) {
    return 'D_parser_limitation';
  }
  if (
    rootCauseClass === 'normalized_payload_or_publish_partial' ||
    rootCauseClass === 'publish_resolver_partial'
  ) {
    return 'E_merge_limitation';
  }
  if (
    rootCauseClass === 'event_artists_write_skipped' ||
    rootCauseClass === 'stale_production_or_publish_skip'
  ) {
    return 'F_publish_limitation';
  }
  if (stage === 14 || stage === 15) return 'G_projection_limitation';
  if (rootCauseClass === 'detail_url_missing' || rootCauseClass === 'lineup_on_flyer_only') {
    return 'H_source_limitation';
  }
  if (rootCauseClass === 'title_inferred_only' || rootCauseClass === 'single_artist_complete') {
    return stage === 3 ? 'B_detail_fetch_failed' : 'H_source_limitation';
  }
  if (rootCauseClass === 'none') return 'A_source_no_lineup';
  return 'D_parser_limitation';
}

async function probeColumn(table: string, column: string): Promise<boolean> {
  const { error } = await opsClient().from(table).select(column).limit(1);
  return !error;
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    adminArtistRepository: registry.adminArtistRepository,
    eventRepository: registry.eventRepository,
    importAggregationService: registry.importAggregationService,
    importEventPublishService: registry.importEventPublishService,
    importRecordRepository: registry.importRecordRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function collectCounts() {
  const c = opsClient();
  const [published, origins, eventArtists, saved] = await Promise.all([
    c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    c.from('event_source_references').select('id', { count: 'exact', head: true }).eq('active', true),
    c.from('event_artists').select('id', { count: 'exact', head: true }),
    c.from('saved_events').select('id', { count: 'exact', head: true }).then((r) => r).catch(() => ({ count: 0 })),
  ]);
  return {
    publishedEvents: published.count ?? 0,
    activeOrigins: origins.count ?? 0,
    eventArtistRows: eventArtists.count ?? 0,
    savedRelationships: saved.count ?? 0,
  };
}

async function runPreflight(): Promise<void> {
  if (process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE !== 'true') {
    fail('EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE must be true');
  }

  const columnProbes: Record<string, boolean> = {};
  for (const col of SCHEMA_COLUMNS) {
    columnProbes[col] = await probeColumn('events', col);
  }
  if (Object.values(columnProbes).some((ok) => !ok)) {
    fail('Required schema columns missing');
  }

  const c = opsClient();
  const { data: activeJobs } = await c
    .from('import_jobs')
    .select('id,source_id,status')
    .in('status', ['pending', 'running']);
  if ((activeJobs ?? []).length > 0) {
    fail(`Active import jobs: ${activeJobs!.map((j) => j.id).join(', ')}`);
  }

  const counts = await collectCounts();
  if (counts.publishedEvents !== EXPECTED_PUBLISHED) {
    fail(`Published count ${counts.publishedEvents} differs from baseline ${EXPECTED_PUBLISHED}`);
  }

  if (!existsSync(BASELINE_MATRIX)) {
    fail(`Baseline matrix missing: ${BASELINE_MATRIX}`);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_MATRIX, 'utf8')) as { publishedTotal: number };
  if (baseline.publishedTotal !== EXPECTED_PUBLISHED) {
    fail('Baseline matrix publishedTotal mismatch');
  }

  state.preflight = {
    generatedAt: new Date().toISOString(),
    targetHost: supabaseHost(),
    fieldTrustMerge: true,
    columnProbes,
    counts,
    baselinePublished: EXPECTED_PUBLISHED,
    commit: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
  };
  saveState();
  console.log(JSON.stringify(state.preflight, null, 2));
}

async function validateSources(): Promise<void> {
  const c = opsClient();
  const { data: sources } = await c
    .from('sources')
    .select('*')
    .eq('enabled', true)
    .eq('archived', false);

  const audits: unknown[] = [];
  const defects: string[] = [];

  for (const row of sources ?? []) {
    const source = mapSourceRowToRecord(row as SourceRow);
    const config = (row.source_config ?? {}) as Record<string, unknown>;
    const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
    const limits = (ticketPlatform.limits ?? {}) as Record<string, unknown>;
    const maxDetailPages = Number(limits.maxDetailPages ?? 0);
    const isDetailCapable =
      source.sourceType === 'ticket_platform' ||
      source.id.includes('ticket-io') ||
      source.id.includes('ticket-kings');

    const { count: importCount } = await c
      .from('import_records')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', source.id);

    const sampleImport = await c
      .from('import_records')
      .select('normalized_payload')
      .eq('source_id', source.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const payload = sampleImport.data?.normalized_payload as Record<string, unknown> | null;
    const metadata = (payload?.sourceMetadata ?? {}) as Record<string, unknown>;
    const detail = (metadata.detailEnrichment ?? {}) as Record<string, unknown>;

    if (isDetailCapable && maxDetailPages <= 0) {
      defects.push(`${source.id}: maxDetailPages=0`);
    }

    audits.push({
      sourceId: source.id,
      displayName: source.displayName,
      sourceType: source.sourceType,
      connectorKey: source.connectorKey,
      listUrl: source.listUrl,
      detailStrategy: ticketPlatform.detailStrategy ?? config.detailStrategy,
      maxDetailPages,
      allowedDomains: ticketPlatform.allowedDomains ?? config.allowedDomains,
      detailEnrichmentEnabled: config.detailEnrichmentEnabled ?? true,
      importRecordCount: importCount ?? 0,
      sampleDetailPagesFetched: detail.pagesFetched ?? 0,
      sampleDetailBlocked: detail.blockedByPow === true,
    });
  }

  state.sourceValidation = { generatedAt: new Date().toISOString(), audits, defects };
  saveState();
  console.log(`Sources validated: ${audits.length}, defects: ${defects.length}`);
  if (defects.length > 0) {
    console.log('Defects will be patched in gate phase:', defects);
  }
}

async function patchTicketPlatformDetailLimits(): Promise<string[]> {
  const patched: string[] = [];
  const c = opsClient();
  const { data: sources } = await c
    .from('sources')
    .select('id,source_config,source_type')
    .or('id.ilike.%ticket-kings%,id.ilike.%ticket-io%,connector_key.eq.ticket_platform');

  for (const row of sources ?? []) {
    const config = row.source_config as Record<string, unknown>;
    const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
    const limits = (ticketPlatform.limits ?? {}) as Record<string, unknown>;
    if (Number(limits.maxDetailPages ?? 0) > 0) continue;
    limits.maxDetailPages = 15;
    ticketPlatform.limits = limits;
    config.ticketPlatform = ticketPlatform;
    await c
      .from('sources')
      .update({ source_config: config, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    patched.push(row.id);
  }
  return patched;
}

async function backupProductionState(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const { data: allArtists } = await c.from('artists').select('id,name');
  const artistsById = new Map((allArtists ?? []).map((a) => [a.id, a] as const));

  const backupEvents = [];
  for (const event of events ?? []) {
    const admin = mapEventRowToAdminRecord(event as EventRow);
    const { data: origins } = await c
      .from('event_source_references')
      .select('source_id,metadata,active')
      .eq('canonical_event_id', event.id);
    const { data: ea } = await c
      .from('event_artists')
      .select('artist_id,billing_role,sort_order')
      .eq('event_id', event.id)
      .order('sort_order');
    const { count: savedCount } = await c
      .from('saved_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .then((r) => r)
      .catch(() => ({ count: 0 }));

    const artistNames = (ea ?? []).map((r) => artistsById.get(r.artist_id)?.name ?? r.artist_id);

    backupEvents.push({
      eventId: event.id,
      title: event.title,
      publicationStatus: event.status,
      origins: origins ?? [],
      artistRelationships: ea ?? [],
      artistNames,
      lineupCompleteness: admin.lineup?.length ? 'has_lineup' : 'empty',
      description: event.description,
      ticketUrl: event.ticket_url,
      priceText: event.price_text,
      ticketStatus: event.ticket_status,
      genres: event.genre_labels,
      venue: event.venue,
      venueAddress: event.venue_address,
      coordinates: { lat: event.latitude, lng: event.longitude },
      savedCount: savedCount ?? 0,
    });
  }

  const backup = {
    generatedAt: new Date().toISOString(),
    counts: await collectCounts(),
    configFingerprint: createHash('sha256')
      .update(JSON.stringify(state.sourceValidation ?? {}))
      .digest('hex')
      .slice(0, 16),
    events: backupEvents,
  };
  writeFileSync(OUT_BACKUP, JSON.stringify(backup, null, 2));
  state.backup = { generatedAt: backup.generatedAt, eventCount: backupEvents.length };
  saveState();
}

async function runImportPass(passLabel: 'pass1' | 'pass2'): Promise<void> {
  const {
    importAggregationService,
    initializeEntityAliasStore,
    flushEntityAliasStore,
    importEventPublishService,
    importRecordRepository,
    eventRepository,
  } = await loadRegistry();
  await initializeEntityAliasStore();

  const c = opsClient();
  const { data: sourceRows } = await c
    .from('sources')
    .select('*')
    .eq('enabled', true)
    .eq('archived', false);

  const sources = (sourceRows ?? [])
    .map((row) => mapSourceRowToRecord(row as SourceRow))
    .filter((s) => !s.id.includes('staging') && s.sourceType !== 'manual')
    .sort((a, b) => {
      const ai = REIMPORT_SOURCE_ORDER.indexOf(a.id);
      const bi = REIMPORT_SOURCE_ORDER.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  const results: unknown[] = [];
  for (const source of sources) {
    console.log(`[${passLabel}] ${source.id}...`);
    const job = await importAggregationService.enqueueJob(source, 'manual', `phase464:${passLabel}`);
    const completed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: true,
    });

    let republished = 0;
    let lineupRepairs = 0;
    const jobRecords = await importRecordRepository.listByJobId(completed.id);
    for (const record of jobRecords) {
      if (!record.resultingEventId) continue;
      if (source.publishMode === 'manual_review' || source.reviewRequired) {
        await importEventPublishService.publishRecord(record, source, [], {
          actorId: `phase464-${passLabel}`,
        });
        republished += 1;
      }
      const repaired = await importEventPublishService.repairLineupProjectionIfNeeded(
        record,
        record.resultingEventId,
      );
      if (repaired?.wroteLineup) lineupRepairs += 1;
    }

    results.push({
      sourceId: source.id,
      jobId: completed.id,
      metrics: completed.metrics,
      republishedRecords: republished,
      lineupRepairsOnStablePath: lineupRepairs,
    });
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);

  const outPath = passLabel === 'pass1' ? OUT_PASS1 : OUT_PASS2;
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  state[passLabel] = { completedAt: new Date().toISOString(), sourceCount: results.length };
  saveState();
}

async function runLineupRepairPass(): Promise<void> {
  const { importRecordRepository, importEventPublishService, adminArtistRepository, eventRepository } =
    await loadRegistry();
  const artists = await adminArtistRepository.getAll();
  const artistsById = new Map(artists.map((a) => [a.id, a] as const));
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title').eq('status', 'published');

  const results: unknown[] = [];
  for (const event of events ?? []) {
    const { data: importRows } = await c
      .from('import_records')
      .select('id')
      .eq('resulting_event_id', event.id);
    const records: ImportRecord[] = [];
    for (const row of importRows ?? []) {
      const record = await importRecordRepository.getById(row.id);
      if (record) records.push(record);
    }
    const { data: eaRows } = await c
      .from('event_artists')
      .select('artist_id')
      .eq('event_id', event.id)
      .order('sort_order');
    const existingIds = (eaRows ?? []).map((r) => r.artist_id);
    const picked = pickBestImportRecordForLineupRepair(records, existingIds, artistsById);
    if (!picked?.assessment.shouldRepair) continue;

    const repair = await importEventPublishService.repairLineupProjection(picked.record, event.id);
    results.push({
      eventId: event.id,
      title: event.title,
      reason: picked.assessment.reason,
      wroteLineup: repair.wroteLineup,
      artistCount: repair.artistIds.length,
    });
  }

  await invalidateConsumerEventCaches(eventRepository);
  state.repair = { completedAt: new Date().toISOString(), repaired: results.length, results };
  saveState();
}

async function runLineupAudit(label: string): Promise<Record<string, unknown>> {
  execSync('npx tsx scripts/operations/_phase464-global-lineup-integrity.ts audit-before', {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  const auditPath = join(ROOT, 'docs/real-data/_phase464_global_lineup_audit_before.json');
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as {
    metrics: Record<string, number>;
    events: Array<Record<string, unknown>>;
    rootCauseGroups: Record<string, string[]>;
  };

  const remainingCauses: unknown[] = [];
  let unknownCount = 0;
  for (const row of audit.events) {
    const eventId = row.eventId as string;
    const c = opsClient();
    const { data: event } = await c.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) continue;

    const { data: imports } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id')
      .eq('resulting_event_id', eventId)
      .order('updated_at', { ascending: false });
    const importTraces = (imports ?? []).map((imp) => {
      const record = {
        id: imp.id,
        sourceId: imp.source_id,
        normalizedPayload: imp.normalized_payload,
        status: 'imported',
        externalId: imp.external_id,
      } as ImportRecord;
      const prioritized = extractPrioritizedArtistNames(record);
      const payload = imp.normalized_payload as Record<string, unknown>;
      const metadata = (payload?.sourceMetadata ?? {}) as Record<string, unknown>;
      const detail = (metadata.detailEnrichment ?? {}) as Record<string, unknown>;
      return {
        sourceId: imp.source_id,
        prioritizedNames: prioritized.names,
        prioritizedSource: prioritized.source,
        detailPagesFetched: detail.pagesFetched as number | undefined,
        detailBlockedByPow: detail.blockedByPow === true,
        detailUrl: imp.external_id?.startsWith('http') ? imp.external_id : undefined,
      };
    });

    const { data: ea } = await c.from('event_artists').select('artist_id').eq('event_id', eventId);
    const { data: artists } = await c.from('artists').select('id,name');
    const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));
    const canonicalNames = (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? r.artist_id);
    const invalid = canonicalNames.filter((n) => isLineupPlaceholderArtist(n));
    const validCount = canonicalNames.filter((n) => !isLineupPlaceholderArtist(n)).length;

    const resolved = resolveLineupRootCause({
      eventId,
      title: event.title,
      description: event.description ?? undefined,
      validCanonicalCount: validCount,
      invalidCanonicalNames: invalid,
      canonicalArtistNames: sanitizeLineupArtistNames(canonicalNames) ?? [],
      importTraces,
      imageUrl: event.image_url ?? undefined,
      flyerUrl: event.flyer_url ?? undefined,
    });

    if (resolved.rootCauseClass === 'parser_or_merge_unknown') unknownCount += 1;
    if (resolved.classification !== 'complete') {
      remainingCauses.push({
        eventId,
        title: event.title,
        allowedClass: mapToAllowedRootCause(resolved.rootCauseClass, resolved.firstFailureStage),
        rootCauseClass: resolved.rootCauseClass,
        stage: resolved.firstFailureStage,
        evidence: resolved.failureEvidence,
      });
    }
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    label,
    metrics: audit.metrics,
    rootCauseGroups: audit.rootCauseGroups,
    remainingRootCauses: remainingCauses,
    unknownCount,
    parserOrMergeUnknown: audit.rootCauseGroups.parser_or_merge_unknown?.length ?? 0,
  };

  const outPath = label === 'after-pass1' ? OUT_AFTER_PASS1 : OUT_FINAL_AUDIT;
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  state[`audit_${label}`] = snapshot;
  saveState();
  return snapshot;
}

async function runMultiOriginReconciliation(): Promise<void> {
  const c = opsClient();
  const tables: unknown[] = [];

  for (const pair of MULTI_ORIGIN_PAIRS) {
    const { data: refs } = await c
      .from('event_source_references')
      .select('canonical_event_id,source_id')
      .in('source_id', pair.sourceIds)
      .eq('active', true);

    const eventIds = [...new Set((refs ?? []).map((r) => r.canonical_event_id))];
    for (const eventId of eventIds.slice(0, 15)) {
      const { data: event } = await c.from('events').select('*').eq('id', eventId).maybeSingle();
      if (!event) continue;
      const { data: imports } = await c
        .from('import_records')
        .select('source_id,normalized_payload')
        .eq('resulting_event_id', eventId);
      const bySource = new Map<string, Record<string, unknown>>();
      for (const imp of imports ?? []) {
        bySource.set(imp.source_id, imp.normalized_payload as Record<string, unknown>);
      }

      const fields = ['title', 'description', 'ticketUrl', 'priceText', 'imageUrl'] as const;
      const provenance: Record<string, unknown> = {};
      for (const field of fields) {
        const candidates = pair.sourceIds
          .map((sid) => ({ sourceId: sid, value: bySource.get(sid)?.[field === 'ticketUrl' ? 'ticketUrl' : field] }))
          .filter((c) => c.value);
        provenance[field] = {
          canonical: (event as Record<string, unknown>)[
            field === 'ticketUrl' ? 'ticket_url' : field === 'imageUrl' ? 'image_url' : field === 'priceText' ? 'price_text' : field
          ],
          candidates,
        };
      }

      const ticketUrls = pair.sourceIds
        .map((sid) => String(bySource.get(sid)?.ticketUrl ?? ''))
        .filter(Boolean);
      const bestTicket = pickBestTicketUrl(ticketUrls);
      provenance.ticketUrlSelection = {
        best: bestTicket,
        classifications: ticketUrls.map((url) => ({ url, class: classifyTicketUrl(url) })),
      };

      tables.push({ pair: pair.label, eventId, title: event.title, provenance });
    }
  }

  state.multiOrigin = { generatedAt: new Date().toISOString(), tables };
  saveState();
}

async function runFlyerOnlyInventory(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const candidates: unknown[] = [];

  for (const event of events ?? []) {
    const { data: imports } = await c
      .from('import_records')
      .select('normalized_payload,source_id')
      .eq('resulting_event_id', event.id);
    let importArtistCount = 0;
    for (const imp of imports ?? []) {
      const record = {
        normalizedPayload: imp.normalized_payload,
        sourceId: imp.source_id,
      } as ImportRecord;
      importArtistCount = Math.max(
        importArtistCount,
        extractPrioritizedArtistNames(record).names.length,
      );
    }
    const { count: eaCount } = await c
      .from('event_artists')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id);

    const hasImage = Boolean(event.image_url || event.flyer_url);
    const textualLineup = (eaCount ?? 0) > 0 || importArtistCount > 0;
    if (textualLineup || !hasImage) continue;

    candidates.push({
      eventId: event.id,
      title: event.title,
      sourceIds: [...new Set((imports ?? []).map((i) => i.source_id))],
      imageUrl: event.flyer_url ?? event.image_url,
      textualLineupAvailable: false,
      likelyFlyerLineup: true,
      confidence: 'medium',
      recommendedFollowUp: 'manual_or_future_flyer_enrichment_phase',
    });
  }

  writeFileSync(OUT_FLYER, JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
  state.flyerInventory = { count: candidates.length };
  saveState();
}

async function validateRepresentatives(): Promise<unknown[]> {
  const c = opsClient();
  const results: unknown[] = [];
  const { data: events } = await c.from('events').select('id,title').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));

  for (const rep of REPRESENTATIVE_PATTERNS) {
    const match = (events ?? []).find((e) => rep.pattern.test(e.title));
    if (!match) {
      results.push({ label: rep.label, status: 'not_found' });
      continue;
    }
    const { data: ea } = await c
      .from('event_artists')
      .select('artist_id,sort_order,billing_role')
      .eq('event_id', match.id)
      .order('sort_order');
    const names = (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? r.artist_id);
    const invalid = names.filter((n) => isLineupPlaceholderArtist(n) || /^by\s+/i.test(n));
    results.push({
      label: rep.label,
      eventId: match.id,
      title: match.title,
      artistCount: names.length,
      artistNames: names,
      invalidNames: invalid,
      hasOrganization: names.some((n) => /organization/i.test(n)),
      pass: invalid.length === 0,
    });
  }
  state.representativeValidation = results;
  saveState();
  return results;
}

function buildReport(): void {
  const preflight = state.preflight as Record<string, unknown> | undefined;
  const auditFinal = state.audit_final as Record<string, unknown> | undefined;
  const auditPass1 = state['audit_after-pass1'] as Record<string, unknown> | undefined;
  const repair = state.repair as Record<string, unknown> | undefined;

  const lines = [
    '# Phase 4.6.4 — Controlled Lineup Reimport Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Safety preflight',
    '',
    `- Host: ${preflight?.targetHost ?? 'n/a'}`,
    `- Field trust merge: ${preflight?.fieldTrustMerge ?? false}`,
    `- Commit: ${preflight?.commit ?? 'n/a'}`,
    '',
    '## 2. Source configuration validation',
    '',
    `See state artifact: \`docs/real-data/_phase464_controlled_reimport_state.json\``,
    '',
    '## 3. Baseline and backup',
    '',
    `- Backup: \`docs/real-data/_phase464_lineup_backup.json\``,
    `- Baseline published: ${EXPECTED_PUBLISHED}`,
    '',
    '## 4. Pass 1 results',
    '',
    `Artifact: \`docs/real-data/_phase464_lineup_pass1.json\``,
    '',
    '## 5. Lineup repairs',
    '',
    `Repaired events: ${repair?.repaired ?? 0}`,
    '',
    '## 6. Multi-Origin reconciliation',
    '',
    `Tables: ${((state.multiOrigin as { tables?: unknown[] })?.tables ?? []).length}`,
    '',
    '## 7. Before/after consistency metrics',
    '',
    '| Metric | Pass1 after | Final |',
    '| --- | ---: | ---: |',
    `| Complete | ${(auditPass1?.metrics as Record<string, number>)?.complete ?? '—'} | ${(auditFinal?.metrics as Record<string, number>)?.complete ?? '—'} |`,
    `| Partial | ${(auditPass1?.metrics as Record<string, number>)?.partial ?? '—'} | ${(auditFinal?.metrics as Record<string, number>)?.partial ?? '—'} |`,
    `| Missing | ${(auditPass1?.metrics as Record<string, number>)?.missing ?? '—'} | ${(auditFinal?.metrics as Record<string, number>)?.missing ?? '—'} |`,
  ];

  lines.push('', '## 8. Pass 2 idempotency', '', 'See `_phase464_lineup_pass2.json`');
  lines.push('', '## 9. Representative Event results', '');
  for (const row of (state.representativeValidation as unknown[]) ?? []) {
    const r = row as Record<string, unknown>;
    lines.push(`- **${r.label}**: ${r.artistCount ?? 0} artists — ${r.pass ? 'PASS' : 'CHECK'}`);
  }
  lines.push('', '## 14. Flyer-only candidates', '', `Count: ${(state.flyerInventory as { count?: number })?.count ?? 0}`);
  lines.push('', '## 15. Remaining exact root causes', '', `Unknown count: ${auditFinal?.unknownCount ?? '—'}`);
  lines.push('', '## 16. Next data field', '', 'Ticket phases / floor timetable with same provenance model.');

  writeFileSync(OUT_REPORT, lines.join('\n'));
}

async function runTests(): Promise<void> {
  const cmds = [
    'npm run typecheck:app',
    'npm run typecheck:operations',
    'npm run lint',
    'npm test',
    'npm run build:web',
    'npm run validate:build-output',
  ];
  const results: Record<string, string> = {};
  for (const cmd of cmds) {
    try {
      execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
      results[cmd] = 'pass';
    } catch (error) {
      results[cmd] = error instanceof Error ? error.message.slice(0, 200) : 'fail';
    }
  }
  state.tests = results;
  saveState();
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'preflight';
  console.log(`[phase464-reimport] phase=${phase}`);

  if (phase === 'preflight' || phase === 'gate' || phase === 'full') {
    await runPreflight();
    await validateSources();
  }

  if (phase === 'gate' || phase === 'full') {
    const patched = await patchTicketPlatformDetailLimits();
    state.gate = { patchedSources: patched, at: new Date().toISOString() };
    saveState();
    console.log('Patched maxDetailPages:', patched);
  }

  if (phase === 'backup' || phase === 'full') {
    await backupProductionState();
  }

  if (phase === 'pass1' || phase === 'full') {
    if (!existsSync(OUT_PASS1)) {
      await runImportPass('pass1');
    }
    await runLineupRepairPass();
    await runLineupAudit('after-pass1');
  }

  if (phase === 'repair') {
    await runLineupRepairPass();
  }

  if (phase === 'audit-pass1') {
    await runLineupAudit('after-pass1');
  }

  if (phase === 'pass2' || phase === 'full') {
    await runImportPass('pass2');
    await runLineupAudit('final');
  }

  if (phase === 'multi-origin' || phase === 'full') {
    await runMultiOriginReconciliation();
  }

  if (phase === 'flyer-inventory' || phase === 'full') {
    await runFlyerOnlyInventory();
  }

  if (phase === 'representatives' || phase === 'full') {
    await validateRepresentatives();
  }

  if (phase === 'tests' || phase === 'full') {
    await runTests();
  }

  if (phase === 'report' || phase === 'full') {
    buildReport();
    console.log(`Report: ${OUT_REPORT}`);
  }

  state.completedAt = new Date().toISOString();
  saveState();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
