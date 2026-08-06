/**
 * Phase 4.6.4.1 — Ticket.io detail pipeline audit & controlled repair.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4641-ticketio-pipeline-audit.ts [phase]
 *
 * Phases: audit | repair | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { withTicketIoEffectiveLimits } from '@/features/aggregation/connectors/ticket-platform/ticket-io-effective-config';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import {
  isLineupPlaceholderArtist,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_TRACE = join(ROOT, 'docs/real-data/_phase4641_ticketio_pipeline_trace.json');
const OUT_BEFORE_AFTER = join(ROOT, 'docs/real-data/_phase4641_ticketio_before_after.json');
const OUT_INVALID = join(ROOT, 'docs/real-data/_phase4641_invalid_lineups.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_4641_TICKETIO_DETAIL_PIPELINE_REPORT.md');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase4641_ticketio_state.json');

const TICKET_IO_SOURCE_IDS = [
  'source-ticket-io-lehmannclub',
  'source-ticket-io-technodampfer',
  'source-ticket-io-protontheclub',
  'source-ticket-io-area51events',
  'source-ticket-io-hmg-concerts',
  'source-bootshaus-ticket-io',
];

const REPRESENTATIVE_PATTERNS = [
  { label: 'Bootshaus on a Ship', pattern: /bootshaus\s+on\s+a\s+ship/i },
  { label: 'Vision Ekstase', pattern: /vision\s+ekstase/i },
  { label: 'PURE TECHNO', pattern: /pure\s+techno/i },
  { label: 'Blacklist Festival', pattern: /blacklist\s+festival/i },
  { label: 'LEVI', pattern: /\blevi\b/i },
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest\s+elektroküche/i },
  { label: 'MDMA', pattern: /\bmdma\b/i },
  { label: '100% SCHRANZ', pattern: /100%\s*schr?anz/i },
];

type State = Record<string, unknown>;

function loadState(): State {
  return existsSync(OUT_STATE) ? (JSON.parse(readFileSync(OUT_STATE, 'utf8')) as State) : {};
}

const state = loadState();

function saveState(): void {
  writeFileSync(OUT_STATE, JSON.stringify(state, null, 2));
}

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

async function collectTicketIoMetrics(): Promise<Record<string, number>> {
  const c = opsClient();
  const sourceFilter = TICKET_IO_SOURCE_IDS;
  let pagesFetchedPositive = 0;
  let detailFetchedEvents = 0;
  let withDescription = 0;
  let withPrice = 0;
  let withGenres = 0;
  let completeLineup = 0;
  let partialLineup = 0;
  let missingLineup = 0;
  let invalidLineup = 0;

  const { data: events } = await c.from('events').select('id,title,description,price_text,genre_labels,status').eq('status', 'published');
  const { data: imports } = await c
    .from('import_records')
    .select('resulting_event_id,source_id,normalized_payload')
    .in('source_id', sourceFilter);

  const importsByEvent = new Map<string, typeof imports>();
  for (const imp of imports ?? []) {
    if (!imp.resulting_event_id) continue;
    const list = importsByEvent.get(imp.resulting_event_id) ?? [];
    list.push(imp);
    importsByEvent.set(imp.resulting_event_id, list);
  }

  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));

  for (const event of events ?? []) {
    const eventImports = importsByEvent.get(event.id);
    if (!eventImports?.length) continue;

    for (const imp of eventImports) {
      const payload = imp.normalized_payload as Record<string, unknown> | null;
      const meta = (payload?.sourceMetadata ?? {}) as Record<string, unknown>;
      const detail = (meta.detailEnrichment ?? {}) as Record<string, unknown>;
      if (Number(detail.pagesFetched ?? 0) > 0 || detail.detailFetched === true) {
        pagesFetchedPositive += 1;
      }
      if (Number(detail.shopPagesFetched ?? 0) > 0) {
        detailFetchedEvents += 1;
      }
    }

    if (event.description?.trim()) withDescription += 1;
    if (event.price_text?.trim()) withPrice += 1;
    if (Array.isArray(event.genre_labels) && event.genre_labels.length > 0) withGenres += 1;

    const { data: ea } = await c.from('event_artists').select('artist_id').eq('event_id', event.id);
    const names = (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? '');
    const invalid = names.filter((n) => isLineupPlaceholderArtist(n) || /^by\s+/i.test(n));
    if (invalid.length > 0) {
      invalidLineup += 1;
    } else if (names.length === 0) {
      missingLineup += 1;
    } else if (names.length <= 2) {
      partialLineup += 1;
    } else {
      completeLineup += 1;
    }
  }

  return {
    ticketIoPublishedWithOrigin: importsByEvent.size,
    importRecordsWithPagesFetched: pagesFetchedPositive,
    eventsWithShopDetailFetch: detailFetchedEvents,
    withDescription,
    withPrice,
    withGenres,
    completeLineup,
    partialLineup,
    missingLineup,
    invalidLineup,
  };
}

async function probeSourcePipeline(sourceId: string): Promise<Record<string, unknown>> {
  const { adminSourceRepository } = await loadRegistry();
  const source = await adminSourceRepository.getById(sourceId);
  if (!source) {
    return { sourceId, error: 'source_not_found' };
  }

  const importSource = mapSourceRecordToImportSource(source);
  const aggregationSource = mapSourceRecordToAggregationSource(source);
  const rawConfig = importSource.sourceConfig?.ticketPlatform;
  const config = rawConfig ? withTicketIoEffectiveLimits(rawConfig) : undefined;

  let liveFetch: Record<string, unknown> = {};
  try {
    const events = await fetchTicketPlatformEvents({
      source: aggregationSource,
      importSource,
      connectorKey: 'ticket_platform',
    });
    const sample = events[0];
    const detail = (sample?.sourceMetadata as Record<string, unknown> | undefined)?.detailEnrichment as
      | Record<string, unknown>
      | undefined;
    liveFetch = {
      eventsDiscovered: events.length,
      sampleDetailEnrichment: detail,
      eventsWithDetailFetched: events.filter(
        (e) =>
          Number(
            ((e.sourceMetadata as Record<string, unknown>)?.detailEnrichment as Record<string, unknown>)
              ?.pagesFetched ?? 0,
          ) > 0,
      ).length,
      eventsWithDescription: events.filter((e) => e.description?.trim()).length,
      eventsWithLineup: events.filter((e) => (e.artistNames?.length ?? 0) > 0).length,
      eventsWithPrice: events.filter((e) => e.priceText?.trim()).length,
    };
  } catch (error) {
    liveFetch = { error: error instanceof Error ? error.message : String(error) };
  }

  const c = opsClient();
  const { data: sampleImport } = await c
    .from('import_records')
    .select('normalized_payload,updated_at')
    .eq('source_id', sourceId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = sampleImport?.normalized_payload as Record<string, unknown> | null;
  const storedDetail = ((payload?.sourceMetadata ?? {}) as Record<string, unknown>).detailEnrichment;

  return {
    sourceId,
    displayName: source.displayName,
    shopSlug: config?.shopSlug,
    listUrl: config?.listUrl,
    maxDetailPagesStored: rawConfig?.limits?.maxDetailPages ?? 0,
    maxDetailPagesEffective: config?.limits?.maxDetailPages ?? 0,
    storedSampleDetailEnrichment: storedDetail,
    liveProbe: liveFetch,
    pipelineStages: {
      listPage: liveFetch.error ? 'failed' : 'success',
      detailUrlDiscovery: Number((liveFetch.sampleDetailEnrichment as Record<string, unknown>)?.detailUrlsDiscovered ?? 0) > 0 ? 'success' : 'missing',
      detailFetch:
        Number((liveFetch.sampleDetailEnrichment as Record<string, unknown>)?.detailUrlsFetched ?? 0) > 0
          ? 'success'
          : ((liveFetch.sampleDetailEnrichment as Record<string, unknown>)?.skippedReason as string) ??
            'skipped',
      parser: Number(liveFetch.eventsWithDetailFetched ?? 0) > 0 ? 'success' : 'skipped',
    },
  };
}

async function traceRepresentativeEvents(): Promise<unknown[]> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));
  const traces: unknown[] = [];

  for (const rep of REPRESENTATIVE_PATTERNS) {
    const event = (events ?? []).find((e) => rep.pattern.test(e.title));
    if (!event) {
      traces.push({ label: rep.label, status: 'not_found' });
      continue;
    }

    const admin = mapEventRowToAdminRecord(event as EventRow);
    const { data: imports } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id')
      .eq('resulting_event_id', event.id);
    const { data: ea } = await c
      .from('event_artists')
      .select('artist_id,sort_order')
      .eq('event_id', event.id)
      .order('sort_order');
    const canonicalArtists = (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? r.artist_id);

    const importLayers = (imports ?? []).map((imp) => {
      const record = {
        id: imp.id,
        sourceId: imp.source_id,
        normalizedPayload: imp.normalized_payload,
        status: 'imported',
        externalId: imp.external_id,
      } as ImportRecord;
      const candidate = getEffectiveCandidate(record);
      const prioritized = extractPrioritizedArtistNames(record);
      const payload = imp.normalized_payload as Record<string, unknown>;
      const meta = (payload?.sourceMetadata ?? candidate.sourceMetadata ?? {}) as Record<string, unknown>;
      const detail = (meta.detailEnrichment ?? {}) as Record<string, unknown>;
      return {
        sourceId: imp.source_id,
        externalId: imp.external_id,
        parser: {
          artistNames: candidate.artistNames,
          lineupEntries: meta.lineupEntries,
          description: candidate.description?.slice(0, 120),
          genreNames: candidate.genreNames,
          priceText: candidate.priceText,
        },
        detailEnrichment: detail,
        prioritizedLineup: prioritized,
      };
    });

    traces.push({
      label: rep.label,
      eventId: event.id,
      title: event.title,
      fieldMatrix: {
        source: importLayers,
        canonical: {
          description: admin.description?.slice(0, 120),
          artists: sanitizeLineupArtistNames(canonicalArtists),
          genres: admin.genreLabels,
          priceText: admin.priceText,
          ticketUrl: admin.ticketUrl,
        },
        projection: {
          lineupCompleteness: canonicalArtists.length > 2 ? 'full' : canonicalArtists.length > 0 ? 'partial' : 'none',
        },
      },
    });
  }

  return traces;
}

async function auditInvalidLineups(): Promise<unknown[]> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));
  const invalid: unknown[] = [];

  for (const event of events ?? []) {
    const { data: ea } = await c.from('event_artists').select('artist_id').eq('event_id', event.id);
    const names = (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? '');
    const bad = names.filter((n) => isLineupPlaceholderArtist(n) || /^by\s+/i.test(n));
    if (bad.length === 0) continue;

    const { data: imports } = await c
      .from('import_records')
      .select('source_id,normalized_payload')
      .eq('resulting_event_id', event.id);
    invalid.push({
      eventId: event.id,
      title: event.title,
      invalidArtists: bad,
      importSources: (imports ?? []).map((i) => i.source_id),
      offendingText: bad,
      parserStage: 'title_inference_or_json_ld_performer',
      genericFix: 'reject_by_prefix_organizer_credits',
    });
  }

  return invalid;
}

async function patchTicketIoDetailLimits(): Promise<string[]> {
  const patched: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  const c = opsClient();
  const { data: sources, error: queryError } = await c
    .from('sources')
    .select('id,source_config')
    .in('id', TICKET_IO_SOURCE_IDS);

  if (queryError) {
    throw new Error(`Ticket.io config patch query failed: ${queryError.message}`);
  }

  for (const row of sources ?? []) {
    const config = (row.source_config ?? {}) as Record<string, unknown>;
    const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
    const limits = (ticketPlatform.limits ?? {}) as Record<string, unknown>;
    if (Number(limits.maxDetailPages ?? 0) > 0) {
      continue;
    }
    limits.maxDetailPages = 15;
    ticketPlatform.limits = limits;
    config.ticketPlatform = ticketPlatform;
    const { error } = await c
      .from('sources')
      .update({ source_config: config, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!error) {
      patched.push(row.id);
      continue;
    }
    failed.push({ id: row.id, error: error.message });
  }

  if (failed.length > 0) {
    console.warn('Ticket.io config patch failures:', failed);
  }

  return patched;
}

async function runAudit(): Promise<void> {
  state.beforeMetrics = await collectTicketIoMetrics();
  state.sourcePipelines = [];
  for (const sourceId of TICKET_IO_SOURCE_IDS) {
    console.log(`[audit] probing ${sourceId}...`);
    state.sourcePipelines.push(await probeSourcePipeline(sourceId));
  }
  state.representativeTraces = await traceRepresentativeEvents();
  state.invalidLineups = await auditInvalidLineups();
  saveState();

  writeFileSync(
    OUT_TRACE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourcePipelines: state.sourcePipelines,
        representativeTraces: state.representativeTraces,
        invalidLineups: state.invalidLineups,
      },
      null,
      2,
    ),
  );
  writeFileSync(OUT_INVALID, JSON.stringify({ generatedAt: new Date().toISOString(), invalid: state.invalidLineups }, null, 2));
  console.log(JSON.stringify(state.beforeMetrics, null, 2));
}

async function runLineupRepair(): Promise<void> {
  const {
    importEventPublishService,
    importRecordRepository,
    initializeEntityAliasStore,
    flushEntityAliasStore,
    eventRepository,
    adminSourceRepository,
  } = await loadRegistry();
  await initializeEntityAliasStore();
  const c = opsClient();

  const results: unknown[] = [];
  for (const sourceId of TICKET_IO_SOURCE_IDS) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source?.enabled || source.archived) continue;
    const { data: rows } = await c
      .from('import_records')
      .select('id,source_id,resulting_event_id,status,external_id,normalized_payload')
      .eq('source_id', sourceId)
      .not('resulting_event_id', 'is', null);
    let repaired = 0;
    for (const row of rows ?? []) {
      const record = await importRecordRepository.getById(row.id);
      if (!record?.resultingEventId) continue;
      const result = await importEventPublishService.repairLineupProjectionIfNeeded(
        record,
        record.resultingEventId,
      );
      if (result.wroteLineup) repaired += 1;
    }
    results.push({ sourceId, repaired, scanned: rows?.length ?? 0 });
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);
  state.lineupRepair = { completedAt: new Date().toISOString(), results };
  state.invalidLineups = await auditInvalidLineups();
  state.afterMetrics = await collectTicketIoMetrics();
  saveState();
  writeFileSync(
    OUT_BEFORE_AFTER,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        before: state.beforeMetrics,
        after: state.afterMetrics,
        repair: state.repair,
        lineupRepair: state.lineupRepair,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    OUT_INVALID,
    JSON.stringify({ generatedAt: new Date().toISOString(), invalid: state.invalidLineups }, null, 2),
  );
  console.log(JSON.stringify(state.lineupRepair, null, 2));
}

async function runRepair(): Promise<void> {
  const patched = await patchTicketIoDetailLimits();
  state.configPatch = { patchedSources: patched, at: new Date().toISOString() };
  console.log('patched maxDetailPages:', patched);

  const {
    importAggregationService,
    importEventPublishService,
    importRecordRepository,
    initializeEntityAliasStore,
    flushEntityAliasStore,
    eventRepository,
    adminSourceRepository,
  } = await loadRegistry();
  await initializeEntityAliasStore();

  const results: unknown[] = [];
  for (const sourceId of TICKET_IO_SOURCE_IDS) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source?.enabled || source.archived) {
      results.push({ sourceId, status: 'skipped_disabled' });
      continue;
    }
    console.log(`[repair] ${sourceId}...`);
    const job = await importAggregationService.enqueueJob(source, 'manual', 'phase4641:ticket-io-repair');
    const completed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: true,
    });

    let republished = 0;
    let lineupRepairs = 0;
    const jobRecords = await importRecordRepository.listByJobId(completed.id);
    for (const record of jobRecords) {
      if (!record.resultingEventId) continue;
      if (source.publishMode === 'manual_review' || source.reviewRequired) {
        await importEventPublishService.publishRecord(record, source, [], { actorId: 'phase4641-ticket-io' });
        republished += 1;
      }
      const repaired = await importEventPublishService.repairLineupProjectionIfNeeded(
        record,
        record.resultingEventId,
      );
      if (repaired?.wroteLineup) lineupRepairs += 1;
    }

    results.push({ sourceId, jobId: completed.id, metrics: completed.metrics, republished, lineupRepairs });
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);
  state.repair = { completedAt: new Date().toISOString(), results };
  state.afterMetrics = await collectTicketIoMetrics();
  saveState();

  writeFileSync(
    OUT_BEFORE_AFTER,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        before: state.beforeMetrics,
        after: state.afterMetrics,
        repair: state.repair,
      },
      null,
      2,
    ),
  );
}

function buildReport(): void {
  const before = state.beforeMetrics as Record<string, number> | undefined;
  const after = state.afterMetrics as Record<string, number> | undefined;
  const pipelines = (state.sourcePipelines ?? []) as Array<Record<string, unknown>>;
  const configPatch = state.configPatch as { patchedSources?: string[] } | undefined;
  const invalid = (state.invalidLineups ?? []) as Array<Record<string, unknown>>;

  const pipelineTable = pipelines
    .map((p) => {
      const probe = (p.liveProbe ?? {}) as Record<string, unknown>;
      const detail = (probe.sampleDetailEnrichment ?? {}) as Record<string, unknown>;
      return `| ${p.displayName} | ${detail.detailUrlsDiscovered ?? 0} | ${detail.detailUrlsAttempted ?? 0} | ${detail.detailUrlsFetched ?? 0} | ${detail.detailUrlsPowBlocked ?? 0} | ${p.maxDetailPagesStored ?? 0} | ${p.maxDetailPagesEffective ?? 0} | ${(p.pipelineStages as Record<string, string>)?.detailFetch ?? '—'} |`;
    })
    .join('\n');

  const lines = [
    '# Phase 4.6.4.1 — Ticket.io Detail Pipeline Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Pipeline trace summary',
    '',
    'Stages: **list page** → **slug discovery** (event rows + JSON-LD URLs) → **detail fetch** → **HTML** → **JSON-LD / detail parser** → **normalized payload** → **import record** → **field trust merge** → **canonical publish** → **projection** → **public UI**',
    '',
    '### Root cause: `pagesFetched = 0`',
    '',
    'Two sequential blockers were identified:',
    '',
    '1. **Config gap (fixed):** Production `source_config.ticketPlatform.limits` omitted `maxDetailPages`. Runtime now applies the connector default (`15`) via `withTicketIoEffectiveLimits()`. DB patch uses explicit source IDs (migration previously referenced non-existent `connector_key` on `sources`).',
    '2. **PoW gate (remaining):** With limits enabled, all shops discover detail slugs but **100% of detail HTTP responses return Ticket.io ALTCHA / Security check pages** from server-side fetch. List pages succeed; detail pages require browser PoW.',
    '',
    '### Per-source detail fetch audit',
    '',
    '| Shop | URLs discovered | Attempted | Fetched | PoW blocked | Stored limit | Effective limit | Detail stage |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    pipelineTable,
    '',
    '## 2. Parser coverage',
    '',
    '- **List JSON-LD (always available):** title, dates, venue, address, geo, price, ticket URL, image, organizer, placeholder performer (`Unbekannt` filtered)',
    '- **List row enrichment:** genres, price overview text, sold-out hints',
    '- **Detail page (PoW-blocked in production fetch):** description, lineup, ticket phases, attributes, FAQ, minimum age, doors, timetable',
    '',
    '## 3. Import record audit',
    '',
    'Fields available on list JSON-LD flow into `normalized_payload` immediately. Detail-only fields remain absent when `detailEnrichment.skippedReason` is `pow_blocked` or legacy `max_detail_pages_zero`. No silent drops in normalize step — missing fields trace to fetch stage.',
    '',
    '## 4. Canonical publish audit',
    '',
    'Representative gaps are upstream: import records lack detail-sourced lineups/descriptions. Field trust merge cannot publish fields never imported. Bootshaus on a Ship lineup lives on detail HTML / flyer only.',
    '',
    '## 5. Invalid lineup regression',
    '',
    `Affected events: ${invalid.length}. Parser fix: reject ` + '`^by `' + ` organizer credits; skip title inference for ` + '`pres by`' + ` patterns. Repair pass re-projects canonical lineups from sanitized import records.`,
    '',
    '## 6. Generic fixes implemented',
    '',
    '- `ticket-io-effective-config.ts` — default `maxDetailPages: 15` when missing from stored config',
    '- `ticket-io-detail-fetch.ts` — slug discovery + fetch audit; `pow_blocked` skip reason',
    '- `ticket-platform-fetch.ts` — per-event `detailEnrichment.pagesFetched` (0/1)',
    '- `lineup-artist-quality.ts` — reject `^by ` prefix fragments',
    '- `ticket-io-title-artists.ts` — skip `pres by` organizer billing titles',
    '- Ops patch — query by explicit Ticket.io source IDs (not `connector_key`)',
    '',
    '## 7. Controlled repair',
    '',
    `Config patch applied to: ${(configPatch?.patchedSources ?? []).join(', ') || '(see repair log)'}`,
    '',
    '## 8. Before / after metrics',
    '',
    '| Metric | Before | After |',
    '| --- | ---: | ---: |',
    `| Import records with pagesFetched>0 | ${before?.importRecordsWithPagesFetched ?? '—'} | ${after?.importRecordsWithPagesFetched ?? '—'} |`,
    `| Complete lineups | ${before?.completeLineup ?? '—'} | ${after?.completeLineup ?? '—'} |`,
    `| Partial lineups | ${before?.partialLineup ?? '—'} | ${after?.partialLineup ?? '—'} |`,
    `| Missing lineups | ${before?.missingLineup ?? '—'} | ${after?.missingLineup ?? '—'} |`,
    `| With description | ${before?.withDescription ?? '—'} | ${after?.withDescription ?? '—'} |`,
    `| With genres | ${before?.withGenres ?? '—'} | ${after?.withGenres ?? '—'} |`,
    `| With price | ${before?.withPrice ?? '—'} | ${after?.withPrice ?? '—'} |`,
    `| Invalid lineups | ${before?.invalidLineup ?? '—'} | ${after?.invalidLineup ?? '—'} |`,
    '',
    '## 9. Remaining blockers',
    '',
    '- **Ticket.io ALTCHA PoW** on all detail page URLs from server-side HTTP client',
    '- Lineups/descriptions only on detail HTML or flyer artwork for many events',
    '- List JSON-LD uses `performer: Unbekannt` placeholder when real lineup is detail-only',
    '',
    '## 10. Recommendation for next data field',
    '',
    'Before flyer/OCR: evaluate **Ticket.io PoW bypass strategy** (headless browser session, official API, or CDN/event JSON endpoint). Until detail HTML is obtainable server-side, lineup completion for Ticket.io detail-only events cannot reach 100%.',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase4641_ticketio_pipeline_trace.json`',
    '- `docs/real-data/_phase4641_ticketio_before_after.json`',
    '- `docs/real-data/_phase4641_invalid_lineups.json`',
  ];

  writeFileSync(OUT_REPORT, lines.join('\n'));
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'audit';
  if (phase === 'audit' || phase === 'full') {
    await runAudit();
  }
  if (phase === 'lineup-repair') {
    await runLineupRepair();
  }
  if (phase === 'repair' || phase === 'full') {
    await runRepair();
    state.representativeTraces = await traceRepresentativeEvents();
    state.invalidLineups = await auditInvalidLineups();
    saveState();
  }
  if (phase === 'report' || phase === 'full') {
    buildReport();
    console.log(`Report: ${OUT_REPORT}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
