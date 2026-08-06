/**
 * Phase 4.6.6 — Textual detail completion audit, controlled repair and report.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase466-textual-completion.ts [phase]
 *
 * Phases: audit | backup | repair | pass2 | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import {
  classifyOutboundTicketLink,
  extractOutboundTicketLinksFromText,
} from '@/features/aggregation/domain/cross-source-ticket-discovery';
import { isDetailFetchBlocked } from '@/features/events/domain/blocked-origin-guard';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import {
  assessTextualCompleteness,
  buildTextualCompletenessInputFromLayers,
} from '@/features/events/quality/textual-completeness-classifier';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_MATRIX = join(ROOT, 'docs/real-data/_phase466_textual_matrix.json');
const OUT_FLYER = join(ROOT, 'docs/real-data/_phase466_remaining_flyer_candidates.json');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase466_textual_backup.json');
const OUT_BEFORE = join(ROOT, 'docs/real-data/_phase466_metrics_before.json');
const OUT_AFTER = join(ROOT, 'docs/real-data/_phase466_metrics_after.json');
const OUT_CHANGES = join(ROOT, 'docs/real-data/_phase466_field_changes.json');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase466_textual_state.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_466_TEXTUAL_COMPLETION_REPORT.md');

const WEBSITE_PARSER_AUDIT = [
  {
    source: 'Bootshaus',
    sourceId: 'source-bootshaus-koeln',
    strategy: 'html_selector + list/detail enrichment',
    supported: ['lineup', 'description', 'genres', 'venue', 'ticket links', 'images', 'organizer'],
    partial: ['address', 'coordinates', 'timetable', 'attributes', 'doors', 'minimum age'],
    unsupported: ['structured FAQ', 'multi-floor HTML blocks without text'],
  },
  {
    source: 'Affenkäfig',
    sourceId: 'source-affenkaefig',
    strategy: 'json_ld + custom ecm-event-lineup parser',
    supported: ['lineup', 'description', 'venue', 'ticket links', 'images'],
    partial: ['genres', 'attributes', 'timetable from description'],
    unsupported: ['coordinates', 'doors structured', 'FAQ blocks'],
  },
  {
    source: 'Musik die mich antreibt (MDMA)',
    sourceId: 'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
    strategy: 'ticket_kings detail parser',
    supported: ['lineup', 'description', 'genres', 'attributes', 'doors', 'minimum age', 'ticket URL', 'price'],
    partial: ['timetable', 'running order from description'],
    unsupported: ['coordinates', 'multi-origin website merge unless linked'],
  },
  {
    source: 'Lehmann Club',
    sourceId: 'source-ticket-io-lehmannclub',
    strategy: 'ticket_io list + detail (detail blocked by ALTCHA)',
    supported: ['title', 'date', 'genre list', 'price', 'ticket URL'],
    partial: ['description from list JSON-LD', 'lineup from description text'],
    unsupported: ['detail HTML while ALTCHA active'],
  },
  {
    source: 'Technodampfer',
    sourceId: 'source-ticket-io-technodampfer',
    strategy: 'ticket_io list + detail (detail blocked by ALTCHA)',
    supported: ['title', 'date', 'genre list', 'price', 'ticket URL'],
    partial: ['description lineup text', 'single-DJ title inference'],
    unsupported: ['detail HTML while ALTCHA active'],
  },
];

const REPAIR_SOURCE_ORDER = [
  'source-bootshaus-koeln',
  'source-affenkaefig',
  'source-bootshaus-ticket-io',
  'source-affenkaefig-ticket-kings',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-technodampfer',
];

const MULTI_ORIGIN_PAIRS = [
  { label: 'Bootshaus', sourceIds: ['source-bootshaus-koeln', 'source-bootshaus-ticket-io'] },
  { label: 'Affenkäfig', sourceIds: ['source-affenkaefig', 'source-affenkaefig-ticket-kings'] },
];

const REPRESENTATIVE_PATTERNS = [
  { label: 'Bootshaus on a Ship', pattern: /bootshaus\s+on\s+a\s+ship/i },
  { label: 'Vision Ekstase', pattern: /vision\s+ekstase/i },
  { label: 'PURE TECHNO', pattern: /pure\s+techno/i },
  { label: 'Blacklist Festival', pattern: /blacklist\s+festival/i },
  { label: 'LEVI', pattern: /\blevi\b/i },
  { label: 'Sommerfest', pattern: /sommerfest/i },
  { label: 'MDMA', pattern: /\bmdma\b/i },
  { label: '100 % SCHRANZ', pattern: /100\s*%?\s*schr?anz/i },
];

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

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    importAggregationService: registry.importAggregationService,
    importEventPublishService: registry.importEventPublishService,
    importRecordRepository: registry.importRecordRepository,
    eventRepository: registry.eventRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function collectMetrics(): Promise<Record<string, number>> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const published = events ?? [];
  let withLineup = 0;
  let withDescription = 0;
  let withGenres = 0;
  let withAddress = 0;
  let withCoordinates = 0;

  for (const event of published) {
    const { data: ea } = await c.from('event_artists').select('artist_id').eq('event_id', event.id);
    if ((ea?.length ?? 0) > 0) withLineup += 1;
    if (event.description?.trim() && event.description.length > 40) withDescription += 1;
    if (Array.isArray(event.genre_labels) && event.genre_labels.length > 0) withGenres += 1;
    if (event.venue_address?.trim()) withAddress += 1;
    if (event.latitude != null && event.longitude != null) withCoordinates += 1;
  }

  return {
    publishedEvents: published.length,
    completeLineups: withLineup,
    descriptions: withDescription,
    genres: withGenres,
    addresses: withAddress,
    coordinates: withCoordinates,
  };
}

async function buildEventMatrix(): Promise<unknown[]> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));
  const matrix: unknown[] = [];

  for (const event of events ?? []) {
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
    const canonicalArtists = sanitizeLineupArtistNames(
      (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? r.artist_id),
    );

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
      const textual = (meta.textualEnrichment ?? {}) as Record<string, unknown>;
      const outboundFromDescription = extractOutboundTicketLinksFromText(candidate.description);
      return {
        sourceId: imp.source_id,
        detailBlocked: isDetailFetchBlocked(meta),
        metadata: meta,
        textualSignals: {
          warnings: meta.warnings,
          runningOrder: textual.runningOrder ?? meta.runningOrder,
          timetable: textual.timetable ?? meta.timetable,
          attributes: textual.attributes ?? meta.eventAttributes,
          outboundTicketLinks: textual.outboundTicketLinks ?? outboundFromDescription,
        },
        fields: {
          description: candidate.description,
          lineup: prioritized.names,
          genreLabels: candidate.genreNames,
          ticketUrl: candidate.ticketUrl,
        },
      };
    });

    const completenessInput = buildTextualCompletenessInputFromLayers({
      canonical: {
        lineup: canonicalArtists,
        description: admin.description,
        genreLabels: admin.genreLabels,
        venueAddress: admin.venueAddress,
        coordinates:
          admin.latitude != null && admin.longitude != null
            ? { lat: admin.latitude, lng: admin.longitude }
            : undefined,
        imageUrl: admin.imageUrl,
      },
      importLayers,
      hasArtwork: Boolean(admin.imageUrl),
    });
    const completeness = assessTextualCompleteness(completenessInput);

    matrix.push({
      eventId: event.id,
      title: event.title,
      completenessClass: completeness.class,
      completenessReason: completeness.reason,
      missingFields: completeness.missingFields,
      importLayers,
    });
  }

  return matrix;
}

async function buildRepresentativeTraces(matrix: unknown[]): Promise<unknown[]> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title').eq('status', 'published');
  const traces: unknown[] = [];

  for (const rep of REPRESENTATIVE_PATTERNS) {
    const event = (events ?? []).find((e) => rep.pattern.test(e.title));
    if (!event) {
      traces.push({ label: rep.label, status: 'not_found' });
      continue;
    }
    const row = (matrix as Array<Record<string, unknown>>).find((m) => m.eventId === event.id);
    traces.push({
      label: rep.label,
      eventId: event.id,
      title: event.title,
      completenessClass: row?.completenessClass,
      missingFields: row?.missingFields,
      importLayers: row?.importLayers,
    });
  }

  return traces;
}

async function buildCrossSourceAudit(): Promise<unknown[]> {
  const c = opsClient();
  const { data: websiteImports } = await c
    .from('import_records')
    .select('id,source_id,normalized_payload,resulting_event_id')
    .in('source_id', ['source-bootshaus-koeln', 'source-affenkaefig'])
    .not('resulting_event_id', 'is', null);

  const audits: unknown[] = [];
  for (const imp of websiteImports ?? []) {
    const payload = imp.normalized_payload as Record<string, unknown>;
    const candidate = getEffectiveCandidate({
      normalizedPayload: payload,
      sourceId: imp.source_id,
    } as ImportRecord);
    const meta = (payload.sourceMetadata ?? {}) as Record<string, unknown>;
    const textual = (meta.textualEnrichment ?? {}) as Record<string, unknown>;
    const outboundRaw = Array.isArray(textual.outboundTicketLinks)
      ? textual.outboundTicketLinks
      : extractOutboundTicketLinksFromText(candidate.description);
    const outbound = outboundRaw.map((link) =>
      typeof link === 'string' ? classifyOutboundTicketLink(link) : link,
    );
    audits.push({
      eventId: imp.resulting_event_id,
      websiteSourceId: imp.source_id,
      outboundTicketLinks: outbound,
      pairedTicketSource:
        imp.source_id === 'source-bootshaus-koeln'
          ? 'source-bootshaus-ticket-io'
          : 'source-affenkaefig-ticket-kings',
    });
  }

  return audits;
}

async function runAudit(): Promise<void> {
  const metrics = await collectMetrics();
  writeFileSync(OUT_BEFORE, JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2));

  const matrix = await buildEventMatrix();
  const representatives = await buildRepresentativeTraces(matrix);
  const crossSource = await buildCrossSourceAudit();

  const classCounts = (matrix as Array<{ completenessClass: string }>).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.completenessClass] = (acc[row.completenessClass] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const flyerCandidates = (matrix as Array<Record<string, unknown>>)
    .filter((row) =>
      ['C_only_flyer_remains', 'E_textual_exists_but_inaccessible'].includes(
        String(row.completenessClass),
      ),
    )
    .map((row) => ({
      eventId: row.eventId,
      title: row.title,
      class: row.completenessClass,
      reason: row.completenessReason,
      missingFields: row.missingFields,
    }));

  writeFileSync(
    OUT_MATRIX,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        websiteParserAudit: WEBSITE_PARSER_AUDIT,
        classCounts,
        crossSourceAudit: crossSource,
        representativeEvents: representatives,
        events: matrix,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    OUT_FLYER,
    JSON.stringify({ generatedAt: new Date().toISOString(), candidates: flyerCandidates }, null, 2),
  );

  state.audit = { generatedAt: new Date().toISOString(), classCounts, metrics };
  saveState();
  console.log(`Published events audited: ${matrix.length}`);
  console.log(`Flyer candidates: ${flyerCandidates.length}`);
}

async function runBackup(): Promise<void> {
  const c = opsClient();
  const { data: sourceRefs } = await c
    .from('event_source_references')
    .select('canonical_event_id,source_id')
    .in('source_id', REPAIR_SOURCE_ORDER)
    .eq('active', true);
  const eventIds = [...new Set((sourceRefs ?? []).map((r) => r.canonical_event_id))];
  const backupEvents: unknown[] = [];

  for (const eventId of eventIds) {
    const { data: event } = await c.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) continue;
    const { data: ea } = await c
      .from('event_artists')
      .select('artist_id,sort_order')
      .eq('event_id', eventId)
      .order('sort_order');
    const { data: imports } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload')
      .eq('resulting_event_id', eventId);
    backupEvents.push({
      eventId,
      event,
      eventArtists: ea ?? [],
      importRecords: imports ?? [],
    });
  }

  writeFileSync(
    OUT_BACKUP,
    JSON.stringify({ generatedAt: new Date().toISOString(), events: backupEvents }, null, 2),
  );
  state.backup = { generatedAt: new Date().toISOString(), eventCount: backupEvents.length };
  saveState();
  console.log(`Backup events: ${backupEvents.length}`);
}

async function runRepairPass(passLabel: 'pass1' | 'pass2'): Promise<void> {
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

  const beforeCounts = new Map<string, number>();
  for (const sourceId of REPAIR_SOURCE_ORDER) {
    const { data: jobs } = await c
      .from('import_jobs')
      .select('metrics')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(2);
    const priorParsed = (jobs?.[1]?.metrics as { parsedCount?: number } | undefined)?.parsedCount;
    if (typeof priorParsed === 'number') {
      beforeCounts.set(sourceId, priorParsed);
    }
  }

  const sources = (sourceRows ?? [])
    .map((row) => mapSourceRowToRecord(row as SourceRow))
    .filter((s) => REPAIR_SOURCE_ORDER.includes(s.id))
    .sort(
      (a, b) => REPAIR_SOURCE_ORDER.indexOf(a.id) - REPAIR_SOURCE_ORDER.indexOf(b.id),
    );

  const results: unknown[] = [];
  for (const source of sources) {
    console.log(`[${passLabel}] ${source.id}...`);
    const before = beforeCounts.get(source.id);
    const job = await importAggregationService.enqueueJob(source, 'manual', `phase466:${passLabel}`);
    const completed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: true,
    });
    const after = completed.metrics?.parsedCount ?? completed.metrics?.fetchedCount ?? 0;
    if (after === 0) {
      results.push({
        sourceId: source.id,
        jobId: completed.id,
        status: 'aborted',
        reason: 'zero_events_parsed',
        metrics: completed.metrics,
      });
      continue;
    }
    if (typeof before === 'number' && after < before * 0.8 && before > 3) {
      results.push({
        sourceId: source.id,
        jobId: completed.id,
        status: 'aborted',
        reason: `parsed_${after}_vs_prior_${before}`,
        metrics: completed.metrics,
      });
      continue;
    }

    let republished = 0;
    const jobRecords = await importRecordRepository.listByJobId(completed.id);
    for (const record of jobRecords) {
      if (!record.resultingEventId) continue;
      if (source.publishMode === 'manual_review' || source.reviewRequired) {
        await importEventPublishService.publishRecord(record, source, [], {
          actorId: `phase466-${passLabel}`,
        });
        republished += 1;
      }
      await importEventPublishService.repairLineupProjectionIfNeeded(record, record.resultingEventId);
    }

    results.push({
      sourceId: source.id,
      jobId: completed.id,
      metrics: completed.metrics,
      republishedRecords: republished,
    });
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);
  state[passLabel] = { completedAt: new Date().toISOString(), results };
  saveState();
}

function buildReport(): void {
  const audit = state.audit as { classCounts?: Record<string, number> } | undefined;
  const beforeMetrics = existsSync(OUT_BEFORE)
    ? (JSON.parse(readFileSync(OUT_BEFORE, 'utf8')) as { metrics?: Record<string, number> }).metrics
    : undefined;
  const afterMetrics = existsSync(OUT_AFTER)
    ? (JSON.parse(readFileSync(OUT_AFTER, 'utf8')) as { metrics?: Record<string, number> }).metrics
    : undefined;
  const lines = [
    '# Phase 4.6.6 — Textual Detail Completion Before Flyer OCR',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Website parser audit',
    '',
    'Generic website connectors audited: Bootshaus, Affenkäfig, MDMA (Ticket Kings), Lehmann, Technodampfer.',
    'Structured HTML, JSON-LD, custom lineup adapters and description/timetable/attribute parsers are now wired through `website-textual-enrichment`.',
  ];

  for (const entry of WEBSITE_PARSER_AUDIT) {
    lines.push(
      '',
      `### ${entry.source}`,
      `- Strategy: ${entry.strategy}`,
      `- Supported: ${entry.supported.join(', ')}`,
      `- Partial: ${entry.partial.join(', ')}`,
      `- Unsupported / blocked: ${entry.unsupported.join(', ')}`,
    );
  }

  lines.push(
    '',
    '## 2. Description lineup extraction',
    '',
    'Extended `lineup-text-parser` with Line Up, Artists, Running Order, Live, Support, Special Guests and B2B/F2F billing units.',
    'Rejects venue, organizer, sponsor, edition, doors and URL noise.',
    '',
    '## 3. Cross-source detail discovery',
    '',
    'Website descriptions are scanned for outbound Ticket.io / Ticket Kings links (`cross-source-ticket-discovery`).',
    'Bootshaus + Ticket.io and Affenkäfig + Ticket Kings remain complementary origins merged per field.',
    '',
    '## 4. Timetable extraction',
    '',
    '`textual-timetable-parser` preserves artist order, stage grouping and optional start/end times without inventing missing times.',
    '',
    '## 5. Attribute extraction',
    '',
    '`textual-attribute-parser` extracts indoor/outdoor/open air, festival, floors, age restriction and doors open from text.',
    '',
    '## 6. Representative events',
    '',
    'See `representativeEvents` in `_phase466_textual_matrix.json`.',
    '',
    '## 7. Controlled repair',
    '',
    `Backup: \`${OUT_BACKUP}\`. Repair sources: ${REPAIR_SOURCE_ORDER.join(', ')}.`,
    'Repair runs twice for idempotency; aborts when a source returns unexpectedly fewer events.',
    '',
    '## 8. Before/after metrics',
    '',
    `Before: ${JSON.stringify(beforeMetrics ?? {})}`,
    `After: ${JSON.stringify(afterMetrics ?? {})}`,
    `Completeness classes (post-repair audit): ${JSON.stringify(audit?.classCounts ?? {})}`,
    '',
    '## 9. Remaining flyer-only events',
    '',
    'See `_phase466_remaining_flyer_candidates.json`. Class E (textual exists but externally inaccessible) is tracked separately from class C.',
    '',
    '## 10. Recommendation for Flyer OCR',
    '',
    'Proceed with flyer OCR only for class C events after class B parser improvements are republished.',
    'Class E events may enter flyer inventory as fallback but must retain documented ALTCHA limitation.',
    'OCR remains the final enrichment stage — not a substitute for textual parsers.',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase466_textual_matrix.json`',
    '- `docs/real-data/_phase466_remaining_flyer_candidates.json`',
    '- `docs/real-data/_phase466_textual_backup.json`',
    '- `docs/real-data/_phase466_metrics_before.json`',
    '- `docs/real-data/_phase466_metrics_after.json`',
  );

  writeFileSync(OUT_REPORT, lines.join('\n'));
  console.log(`Report: ${OUT_REPORT}`);
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';
  if (phase === 'audit' || phase === 'full') {
    await runAudit();
  }
  if (phase === 'backup' || phase === 'repair' || phase === 'pass2' || phase === 'full') {
    if (phase === 'backup' || phase === 'full') {
      await runBackup();
    }
    if (phase === 'repair' || phase === 'full') {
      await runRepairPass('pass1');
      const afterMetrics = await collectMetrics();
      writeFileSync(
        OUT_AFTER,
        JSON.stringify({ generatedAt: new Date().toISOString(), metrics: afterMetrics }, null, 2),
      );
    }
    if (phase === 'pass2' || phase === 'full') {
      await runRepairPass('pass2');
    }
  }
  if (phase === 'report' || phase === 'full') {
    buildReport();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
