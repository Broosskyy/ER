/**
 * Phase 4.6.4 — Global lineup integrity audit & repair.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase464-global-lineup-integrity.ts [phase]
 *
 * Phases:
 *   audit-before | preflight | backup | pass1 | repair | pass2 | audit-after | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import {
  isLineupPlaceholderArtist,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import {
  assessLineupRepairNeed,
  pickBestImportRecordForLineupRepair,
} from '@/features/import/services/lineup-projection-integrity';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { resolveLineupRootCause } from '@/features/aggregation/domain/lineup-root-cause';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_BEFORE = join(ROOT, 'docs/real-data/_phase464_global_lineup_audit_before.json');
const OUT_AFTER = join(ROOT, 'docs/real-data/_phase464_global_lineup_audit_after.json');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase464_global_lineup_state.json');
const OUT_MD = join(ROOT, 'docs/PHASE_464_GLOBAL_LINEUP_INTEGRITY_REPORT.md');

const KNOWN_EXAMPLES = [
  /sommerfest\s+elektroküche/i,
  /\bmdma\b/i,
  /bootshaus\s+on\s+a\s+ship/i,
  /vision\s+ekstase/i,
  /pure\s+techno/i,
  /blacklist\s+festival/i,
  /shock\s*one|shockone/i,
  /lehmann/i,
  /moonbootica/i,
];

type LineupClass = 'complete' | 'partial' | 'missing' | 'invalid' | 'unavailable';

type FailureStage =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | null;

interface ImportTrace {
  importRecordId: string;
  sourceId: string;
  externalId?: string;
  artistNames?: string[];
  lineupEntryCount: number;
  prioritizedNames: string[];
  prioritizedSource: string;
  detailPagesFetched?: number;
  detailBlockedByPow?: boolean;
  parserVersion?: string;
  detailUrl?: string;
}

interface EventAuditRow {
  eventId: string;
  title: string;
  startDate?: string;
  classification: LineupClass;
  canonicalArtistCount: number;
  validCanonicalCount: number;
  invalidCanonicalNames: string[];
  canonicalArtistNames: string[];
  bestImportNameCount: number;
  bestImportSourceId?: string;
  importTraces: ImportTrace[];
  originSourceIds: string[];
  firstFailureStage: FailureStage;
  failureEvidence: string;
  rootCauseHint: string;
  sourceHasLineupButCanonicalMissing: boolean;
}

interface AuditSnapshot {
  generatedAt: string;
  metrics: Record<string, number>;
  rootCauseGroups: Record<string, string[]>;
  events: EventAuditRow[];
  knownExamples: Array<{ label: string; eventId?: string; classification?: LineupClass }>;
}

type State = {
  startedAt: string;
  completedAt?: string;
  backup?: unknown;
  pass1?: unknown;
  pass2?: unknown;
  repair?: unknown;
};

const state: State = existsSync(OUT_STATE)
  ? (JSON.parse(readFileSync(OUT_STATE, 'utf8')) as State)
  : { startedAt: new Date().toISOString() };

function saveState(): void {
  writeFileSync(OUT_STATE, JSON.stringify(state, null, 2));
}

function toImportRecord(row: {
  id: string;
  source_id: string;
  normalized_payload: unknown;
  external_id?: string;
}): ImportRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    normalizedPayload: row.normalized_payload,
    status: 'imported',
    externalId: row.external_id,
  } as ImportRecord;
}

function readImportTrace(row: {
  id: string;
  source_id: string;
  normalized_payload: unknown;
  external_id?: string;
}): ImportTrace {
  const record = toImportRecord(row);
  const prioritized = extractPrioritizedArtistNames(record);
  const payload = row.normalized_payload as Record<string, unknown> | null;
  const metadata = (payload?.sourceMetadata ?? {}) as Record<string, unknown>;
  const detail = (metadata.detailEnrichment ?? metadata.detailSnapshot ?? {}) as Record<string, unknown>;
  const lineupEntries = metadata.lineupEntries ?? detail.lineupEntries;
  return {
    importRecordId: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    artistNames: Array.isArray(payload?.artistNames)
      ? (payload.artistNames as string[])
      : getEffectiveCandidate(record).artistNames,
    lineupEntryCount: Array.isArray(lineupEntries) ? lineupEntries.length : 0,
    prioritizedNames: prioritized.names,
    prioritizedSource: prioritized.source,
    detailPagesFetched:
      typeof metadata.detailEnrichment === 'object' &&
      metadata.detailEnrichment &&
      'pagesFetched' in (metadata.detailEnrichment as object)
        ? Number((metadata.detailEnrichment as Record<string, unknown>).pagesFetched)
        : typeof detail.pagesFetched === 'number'
          ? detail.pagesFetched
          : undefined,
    detailBlockedByPow: detail.blockedByPow === true,
    parserVersion:
      typeof metadata.detailParserVersion === 'string'
        ? metadata.detailParserVersion
        : typeof metadata.parserVersion === 'string'
          ? metadata.parserVersion
          : undefined,
    detailUrl:
      typeof metadata.eventUrl === 'string'
        ? metadata.eventUrl
        : typeof row.external_id === 'string' && row.external_id.startsWith('http')
          ? row.external_id
          : undefined,
  };
}

function descriptionMayContainLineup(description: string | undefined): boolean {
  if (!description?.trim()) return false;
  return /line[\s-]?up|running\s+order|timetable|b2b|f2f|dj[s]?\s*:/i.test(description);
}

function mapRootCauseToLineupClass(
  classification: ReturnType<typeof resolveLineupRootCause>['classification'],
): LineupClass {
  if (classification === 'title_inferred_only' || classification === 'flyer_extracted_review_required') {
    return 'partial';
  }
  return classification;
}

function classifyAndInferFailure(input: {
  eventId: string;
  title: string;
  description?: string;
  validCanonicalCount: number;
  invalidCanonicalNames: string[];
  canonicalArtistNames: string[];
  importTraces: ImportTrace[];
  imageUrl?: string;
  flyerUrl?: string;
}): {
  classification: LineupClass;
  firstFailureStage: FailureStage;
  failureEvidence: string;
  rootCauseHint: string;
} {
  const resolved = resolveLineupRootCause({
    eventId: input.eventId,
    title: input.title,
    description: input.description,
    validCanonicalCount: input.validCanonicalCount,
    invalidCanonicalNames: input.invalidCanonicalNames,
    canonicalArtistNames: input.canonicalArtistNames,
    importTraces: input.importTraces,
    imageUrl: input.imageUrl,
    flyerUrl: input.flyerUrl,
  });

  return {
    classification: mapRootCauseToLineupClass(resolved.classification),
    firstFailureStage: resolved.firstFailureStage as FailureStage,
    failureEvidence: resolved.failureEvidence,
    rootCauseHint: resolved.rootCauseClass,
  };
}

async function runAudit(): Promise<AuditSnapshot> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const { data: allArtists } = await c.from('artists').select('id,name');
  const artistsById = new Map((allArtists ?? []).map((a) => [a.id, a] as const));

  const rows: EventAuditRow[] = [];

  for (const event of events ?? []) {
    const { data: eventArtists } = await c
      .from('event_artists')
      .select('artist_id,sort_order')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true });
    const { data: imports } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id,updated_at')
      .eq('resulting_event_id', event.id)
      .order('updated_at', { ascending: false });
    const { data: refs } = await c
      .from('event_source_references')
      .select('source_id,metadata')
      .eq('canonical_event_id', event.id)
      .eq('active', true);

    const canonicalArtistIds = (eventArtists ?? []).map((r) => r.artist_id);
    const canonicalArtistNames = canonicalArtistIds.map(
      (id) => artistsById.get(id)?.name ?? id,
    );
    const invalidCanonicalNames = canonicalArtistNames.filter((name) =>
      isLineupPlaceholderArtist(name),
    );
    const validCanonicalCount = canonicalArtistIds.filter(
      (id) => !isLineupPlaceholderArtist(artistsById.get(id)?.name),
    ).length;

    const importTraces = (imports ?? []).map(readImportTrace);
    const bestImport = [...importTraces].sort(
      (a, b) => b.prioritizedNames.length - a.prioritizedNames.length,
    )[0];
    const bestImportNameCount = bestImport?.prioritizedNames.length ?? 0;

    const resolved = classifyAndInferFailure({
      eventId: event.id,
      title: event.title,
      description: event.description ?? undefined,
      validCanonicalCount,
      invalidCanonicalNames,
      canonicalArtistNames: sanitizeLineupArtistNames(canonicalArtistNames) ?? [],
      importTraces,
      imageUrl: event.image_url ?? undefined,
      flyerUrl: event.flyer_url ?? undefined,
    });

    rows.push({
      eventId: event.id,
      title: event.title,
      startDate: event.start_date,
      classification: resolved.classification,
      canonicalArtistCount: canonicalArtistIds.length,
      validCanonicalCount,
      invalidCanonicalNames,
      canonicalArtistNames: sanitizeLineupArtistNames(canonicalArtistNames) ?? [],
      bestImportNameCount,
      bestImportSourceId: bestImport?.sourceId,
      importTraces,
      originSourceIds: [...new Set((refs ?? []).map((r) => r.source_id))],
      firstFailureStage: resolved.firstFailureStage,
      failureEvidence: resolved.failureEvidence,
      rootCauseHint: resolved.rootCauseHint,
      sourceHasLineupButCanonicalMissing:
        bestImportNameCount > 0 && validCanonicalCount < bestImportNameCount,
    });
  }

  const metrics = {
    publishedTotal: rows.length,
    complete: rows.filter((r) => r.classification === 'complete').length,
    partial: rows.filter((r) => r.classification === 'partial').length,
    missing: rows.filter((r) => r.classification === 'missing').length,
    invalid: rows.filter((r) => r.classification === 'invalid').length,
    unavailable: rows.filter((r) => r.classification === 'unavailable').length,
    sourceHasLineupButCanonicalMissing: rows.filter((r) => r.sourceHasLineupButCanonicalMissing)
      .length,
    placeholderCanonical: rows.filter((r) => r.invalidCanonicalNames.length > 0).length,
  };

  const rootCauseGroups: Record<string, string[]> = {};
  for (const row of rows) {
    if (row.classification === 'complete') continue;
    const key = row.rootCauseHint;
    rootCauseGroups[key] = rootCauseGroups[key] ?? [];
    rootCauseGroups[key].push(row.eventId);
  }

  const knownExamples = KNOWN_EXAMPLES.map((pattern) => {
    const match = rows.find((r) => pattern.test(r.title));
    return {
      label: pattern.source,
      eventId: match?.eventId,
      classification: match?.classification,
      validCanonical: match?.validCanonicalCount,
      importLineup: match?.bestImportNameCount,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    rootCauseGroups,
    events: rows,
    knownExamples,
  };
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    adminSourceRepository: registry.adminSourceRepository,
    adminArtistRepository: registry.adminArtistRepository,
    eventRepository: registry.eventRepository,
    importAggregationService: registry.importAggregationService,
    importEventPublishService: registry.importEventPublishService,
    importRecordRepository: registry.importRecordRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function loadActiveSources(): Promise<SourceRecord[]> {
  const { data } = await opsClient()
    .from('sources')
    .select('*')
    .eq('enabled', true)
    .eq('archived', false);
  return (data ?? [])
    .map((row) => mapSourceRowToRecord(row as SourceRow))
    .filter((s) => !s.id.includes('staging') && s.sourceType !== 'manual');
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

async function backupLineupState(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title,artist_id').eq('status', 'published');
  const backup = [];
  for (const event of events ?? []) {
    const { data: rows } = await c
      .from('event_artists')
      .select('artist_id,billing_role,sort_order')
      .eq('event_id', event.id)
      .order('sort_order');
    backup.push({ eventId: event.id, title: event.title, artistId: event.artist_id, lineup: rows ?? [] });
  }
  state.backup = { generatedAt: new Date().toISOString(), events: backup };
  saveState();
}

async function repairLineups(audit: AuditSnapshot): Promise<void> {
  const {
    importRecordRepository,
    importEventPublishService,
    adminArtistRepository,
  } = await loadRegistry();
  const artists = await adminArtistRepository.getAll();
  const artistsById = new Map(artists.map((a) => [a.id, a] as const));

  const targets = audit.events.filter(
    (e) =>
      e.sourceHasLineupButCanonicalMissing ||
      e.classification === 'invalid' ||
      e.classification === 'missing',
  );

  const results: Array<Record<string, unknown>> = [];
  for (const target of targets) {
    const c = opsClient();
    const { data: importRows } = await c
      .from('import_records')
      .select('id')
      .eq('resulting_event_id', target.eventId);

    const records: ImportRecord[] = [];
    for (const row of importRows ?? []) {
      const record = await importRecordRepository.getById(row.id);
      if (record) records.push(record);
    }

    const { data: eaRows } = await c
      .from('event_artists')
      .select('artist_id')
      .eq('event_id', target.eventId)
      .order('sort_order');
    const existingIds = (eaRows ?? []).map((r) => r.artist_id);

    const picked = pickBestImportRecordForLineupRepair(records, existingIds, artistsById);
    if (!picked || !picked.assessment.shouldRepair) {
      results.push({
        eventId: target.eventId,
        status: 'skipped_no_repair_candidate',
        reason: picked?.assessment.reason ?? 'no_import_lineup',
      });
      continue;
    }

    const repair = await importEventPublishService.repairLineupProjection(
      picked.record,
      target.eventId,
    );
    results.push({
      eventId: target.eventId,
      title: target.title,
      wroteLineup: repair.wroteLineup,
      artistCount: repair.artistIds.length,
      createdArtistIds: repair.createdArtistIds.length,
      reason: picked.assessment.reason,
    });
  }

  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  state.repair = { completedAt: new Date().toISOString(), results };
  saveState();
}

async function runImportPass(passLabel: 'pass1' | 'pass2'): Promise<void> {
  const {
    importAggregationService,
    initializeEntityAliasStore,
    flushEntityAliasStore,
    importEventPublishService,
    importRecordRepository,
  } = await loadRegistry();
  await initializeEntityAliasStore();

  const sources = await loadActiveSources();
  const results: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    if (!source.enabled || source.archived) continue;
    console.log(`[${passLabel}] ${source.id}...`);
    const job = await importAggregationService.enqueueJob(source, 'manual', `phase464:${passLabel}`);
    const completed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: true,
    });

    let republished = 0;
    if (source.publishMode === 'manual_review' || source.reviewRequired) {
      const jobRecords = await importRecordRepository.listByJobId(completed.id);
      for (const record of jobRecords) {
        if (!record.resultingEventId) continue;
        await importEventPublishService.publishRecord(record, source, [], {
          actorId: 'phase464-global-lineup',
        });
        republished += 1;
      }
    }

    results.push({
      sourceId: source.id,
      jobId: completed.id,
      metrics: completed.metrics,
      republishedRecords: republished,
    });
  }

  await flushEntityAliasStore();
  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  state[passLabel] = { completedAt: new Date().toISOString(), results };
  saveState();
}

function buildReport(before: AuditSnapshot, after?: AuditSnapshot): void {
  const lines = [
    '# Phase 4.6.4 — Global Lineup Integrity Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Baseline',
    '',
    '| Metric | Before | After |',
    '| --- | ---: | ---: |',
    `| Published events | ${before.metrics.publishedTotal} | ${after?.metrics.publishedTotal ?? '—'} |`,
    `| Complete lineup | ${before.metrics.complete} | ${after?.metrics.complete ?? '—'} |`,
    `| Partial lineup | ${before.metrics.partial} | ${after?.metrics.partial ?? '—'} |`,
    `| Missing lineup | ${before.metrics.missing} | ${after?.metrics.missing ?? '—'} |`,
    `| Invalid lineup | ${before.metrics.invalid} | ${after?.metrics.invalid ?? '—'} |`,
    `| Unavailable at sources | ${before.metrics.unavailable} | ${after?.metrics.unavailable ?? '—'} |`,
    `| Source lineup > canonical | ${before.metrics.sourceHasLineupButCanonicalMissing} | ${after?.metrics.sourceHasLineupButCanonicalMissing ?? '—'} |`,
    `| Placeholder canonical | ${before.metrics.placeholderCanonical} | ${after?.metrics.placeholderCanonical ?? '—'} |`,
    '',
    '## 2. Root-cause groups (before)',
    '',
  ];

  for (const [cause, ids] of Object.entries(before.rootCauseGroups).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${cause} (${ids.length})`);
    lines.push('');
    lines.push(ids.slice(0, 20).join(', ') + (ids.length > 20 ? ` … +${ids.length - 20}` : ''));
    lines.push('');
  }

  lines.push('## 3. Known examples');
  lines.push('');
  for (const ex of before.knownExamples) {
    lines.push(`- **${ex.label}**: ${ex.eventId ?? 'not found'} — ${ex.classification ?? 'n/a'} (canonical ${(ex as { validCanonical?: number }).validCanonical ?? 0}, import ${(ex as { importLineup?: number }).importLineup ?? 0})`);
  }

  lines.push('');
  lines.push('## 4. Generic fixes applied');
  lines.push('');
  lines.push('- Ticket Kings `maxDetailPages` production backfill');
  lines.push('- Ticket Kings `<br />` lineup parser');
  lines.push('- Affenkäfig `ecm-event-lineup` HTML grid parser');
  lines.push('- JSON-LD Organization performer rejection');
  lines.push('- Lineup projection integrity repair (partial/invalid/placeholder canonical)');
  lines.push('- Stable-import lineup repair on skip path (orchestrator)');
  lines.push('');
  lines.push('## 5. Production readiness');
  lines.push('');
  if (after) {
    const ready =
      after.metrics.placeholderCanonical === 0 &&
      after.metrics.sourceHasLineupButCanonicalMissing === 0;
    lines.push(ready ? '**READY** — pending live cache verification.' : '**NOT READY** — remaining gaps documented in audit JSON.');
  } else {
    lines.push('**PENDING** — after audit not yet run.');
  }

  writeFileSync(OUT_MD, lines.join('\n'));
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'audit-before';

  if (phase === 'audit-before' || phase === 'preflight' || phase === 'full') {
    const audit = await runAudit();
    writeFileSync(OUT_BEFORE, JSON.stringify(audit, null, 2));
    console.log(JSON.stringify(audit.metrics, null, 2));
    if (phase === 'preflight') return;
  }

  if (phase === 'backup' || phase === 'full') {
    await backupLineupState();
  }

  if (phase === 'pass1' || phase === 'full') {
    const patched = await patchTicketPlatformDetailLimits();
    console.log('patched maxDetailPages:', patched);
    await runImportPass('pass1');
  }

  if (phase === 'repair' || phase === 'full') {
    const audit = JSON.parse(readFileSync(OUT_BEFORE, 'utf8')) as AuditSnapshot;
    await repairLineups(audit);
  }

  if (phase === 'pass2' || phase === 'full') {
    await runImportPass('pass2');
  }

  if (phase === 'audit-after' || phase === 'full') {
    const audit = await runAudit();
    writeFileSync(OUT_AFTER, JSON.stringify(audit, null, 2));
    console.log(JSON.stringify(audit.metrics, null, 2));
  }

  if (phase === 'report' || phase === 'full') {
    const before = JSON.parse(readFileSync(OUT_BEFORE, 'utf8')) as AuditSnapshot;
    const after = existsSync(OUT_AFTER)
      ? (JSON.parse(readFileSync(OUT_AFTER, 'utf8')) as AuditSnapshot)
      : undefined;
    buildReport(before, after);
    console.log(`Report: ${OUT_MD}`);
  }

  state.completedAt = new Date().toISOString();
  saveState();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
