/**
 * Phase 4.6.9 — Global read-only lineup pipeline audit.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase469-global-lineup-pipeline-audit.ts [command]
 *
 * Commands: inventory | trace | contamination | invalid-artists | model-consistency |
 *           root-causes | report | full
 *
 * READ-ONLY: no production mutations.
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyEventRootCause,
  classifyModelConsistency,
  findCollapsedNames,
} from '@/features/aggregation/audit/lineup-audit-classifier';
import {
  LINEUP_PIPELINE_STAGES,
  PARSER_PATH_INVENTORY,
  WRITER_PATH_INVENTORY,
} from '@/features/aggregation/audit/lineup-audit-inventory';
import {
  classifyTitleInference,
  detectInvalidArtistSignals,
  isSuspiciousArtistName,
  lineupFingerprint,
  lineupOverlapRatio,
  structuredLineupFingerprint,
} from '@/features/aggregation/audit/lineup-audit-signals';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { readFlyerLineupEvidence } from '@/features/import/services/flyer-evidence-metadata';
import { readLineupMetadata } from '@/features/import/services/import-lineup-from-record';
import { extractTitleDerivedArtistNames } from '@/features/import/services/import-title-lineup-resolver';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'docs/real-data');
const OUT_MATRIX = join(OUT_DIR, '_phase469_global_event_trace_matrix.json');
const OUT_CONTAMINATION = join(OUT_DIR, '_phase469_cross_event_contamination.json');
const OUT_INVALID_ARTISTS = join(OUT_DIR, '_phase469_invalid_artist_entities.json');
const OUT_MISMATCHES = join(OUT_DIR, '_phase469_structured_legacy_mismatches.json');
const OUT_PARSER = join(OUT_DIR, '_phase469_parser_path_inventory.json');
const OUT_WRITERS = join(OUT_DIR, '_phase469_writer_path_inventory.json');
const OUT_TRACES = join(OUT_DIR, '_phase469_representative_traces.json');
const OUT_ROOT_CAUSES = join(OUT_DIR, '_phase469_root_cause_counts.json');
const OUT_FIX_PLAN = join(OUT_DIR, '_phase469_minimum_fix_plan.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_469_GLOBAL_LINEUP_PIPELINE_AUDIT.md');

const REPRESENTATIVE_TITLE_PATTERNS = [
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest.*elektroküche/i },
  { label: 'LEVI', pattern: /presents\s+levi\b/i },
  { label: 'MDMA', pattern: /\bmdma\b.*f2f/i },
  { label: 'Into The Madness Pre-Party', pattern: /into the madness pre-party/i },
  { label: 'Bootshaus on a Ship Vol. III', pattern: /bootshaus on a ship vol\.\s*iii/i },
  { label: 'Bootshaus on a Ship Vol. IV', pattern: /bootshaus on a ship vol\.\s*iv/i },
  { label: 'KitKatClub 22.08.2026', pattern: /22\.08.*kitkat|kitkat.*22\.08/i },
  { label: 'BC173 Airport Sessions', pattern: /bc173.*airport session/i },
  { label: 'Deborah De Luca', pattern: /deborah de luca/i },
  { label: 'Vision Ekstase', pattern: /vision ekstase/i },
  { label: 'PURE TECHNO', pattern: /pure techno/i },
];

type AuditState = {
  generatedAt: string;
  readOnly: true;
  traces: EventLineupTraceRow[];
  contamination: unknown[];
  invalidArtists: unknown[];
  mismatches: unknown[];
  rootCauseCounts: Record<string, number>;
  metrics: Record<string, number>;
};

function ensureOutDir(): void {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

async function loadPublishedEvents() {
  const c = opsClient();
  const { data, error } = await c
    .from('events')
    .select(
      'id,title,status,start_date,venue_name,organizer_id,source_id,image_url,description,website_url,ticket_url,updated_at,venues(name),organizers(name)',
    )
    .eq('status', 'published')
    .order('start_date', { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
}

async function loadStructuredLineupMap(): Promise<
  Map<string, Array<{ billingRelation: string; artists: string[]; entryId: string }>>
> {
  const c = opsClient();
  const { data } = await c
    .from('event_lineup_entries')
    .select(
      'id,event_id,sort_order,billing_relation,event_lineup_entry_artists(artist_id,sort_order,artists(name))',
    );
  const map = new Map<string, Array<{ billingRelation: string; artists: string[]; entryId: string }>>();
  for (const row of data ?? []) {
    const artists = (row.event_lineup_entry_artists ?? [])
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((entry) => entry.artists?.name ?? entry.artist_id);
    const list = map.get(row.event_id) ?? [];
    list.push({
      entryId: row.id,
      billingRelation: row.billing_relation,
      artists,
    });
    map.set(row.event_id, list);
  }
  return map;
}

async function loadLegacyLineupMap(): Promise<
  Map<string, Array<{ artistId: string; name: string; legacy: boolean }>>
> {
  const c = opsClient();
  const { data } = await c
    .from('event_artists')
    .select('event_id,artist_id,sort_order,artists(name,lineup_legacy_artifact)')
    .order('sort_order', { ascending: true });
  const map = new Map<string, Array<{ artistId: string; name: string; legacy: boolean }>>();
  for (const row of data ?? []) {
    const list = map.get(row.event_id) ?? [];
    list.push({
      artistId: row.artist_id,
      name: row.artists?.name ?? row.artist_id,
      legacy: row.artists?.lineup_legacy_artifact ?? false,
    });
    map.set(row.event_id, list);
  }
  return map;
}

async function loadImportRecordsMap(): Promise<Map<string, ImportRecord[]>> {
  const { importRecordRepository } = await import('@/data/repositories/registry');
  const c = opsClient();
  const { data } = await c.from('import_records').select('id,resulting_event_id').not('resulting_event_id', 'is', null);
  const map = new Map<string, ImportRecord[]>();
  for (const row of data ?? []) {
    if (!row.resulting_event_id) continue;
    const record = await importRecordRepository.getById(row.id);
    if (!record) continue;
    const list = map.get(row.resulting_event_id) ?? [];
    list.push(record);
    map.set(row.resulting_event_id, list);
  }
  return map;
}

async function loadSourceReferences(): Promise<
  Map<string, Array<{ sourceId: string; externalId?: string; url?: string }>>
> {
  const c = opsClient();
  const { data } = await c
    .from('event_source_references')
    .select('canonical_event_id,source_id,external_event_id,original_url');
  const map = new Map<string, Array<{ sourceId: string; externalId?: string; url?: string }>>();
  for (const row of data ?? []) {
    const list = map.get(row.canonical_event_id) ?? [];
    list.push({
      sourceId: row.source_id,
      externalId: row.external_event_id ?? undefined,
      url: row.original_url ?? undefined,
    });
    map.set(row.canonical_event_id, list);
  }
  return map;
}

async function loadApiProjection(eventId: string) {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const { getDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  const event = await getDatasourceBundle().events.getEventById(eventId);
  if (!event) {
    return null;
  }
  return {
    lineupEntries: event.lineupEntries ?? [],
    artists: event.artists ?? [],
    knownArtistNames: event.knownArtistNames ?? [],
    artistIds: event.artistIds ?? [],
    updatedAt: event.updatedAt,
  };
}

async function buildEventTraces(): Promise<EventLineupTraceRow[]> {
  const events = await loadPublishedEvents();
  const structuredMap = await loadStructuredLineupMap();
  const legacyMap = await loadLegacyLineupMap();
  const importMap = await loadImportRecordsMap();
  const originMap = await loadSourceReferences();
  const traces: EventLineupTraceRow[] = [];

  for (const event of events) {
    const structured = structuredMap.get(event.id) ?? [];
    const legacy = legacyMap.get(event.id) ?? [];
    const imports = importMap.get(event.id) ?? [];
    const origins = originMap.get(event.id) ?? [];
    const api = await loadApiProjection(event.id);

    const primaryImport = imports[0];
    const candidate = primaryImport ? getEffectiveCandidate(primaryImport) : undefined;
    const lineupMeta = primaryImport ? readLineupMetadata(primaryImport) : {};
    const flyerEvidence = primaryImport ? readFlyerLineupEvidence(primaryImport) : undefined;
    const simulated = primaryImport ? extractPrioritizedLineupEntries(primaryImport) : { entries: [] };

    const structuredArtistNames = structured.flatMap((entry) => entry.artists);
    const legacyArtistNames = legacy.map((row) => row.name);
    const apiArtistNames = api?.knownArtistNames?.length
      ? api.knownArtistNames
      : (api?.artists ?? []);
    const apiLineupEntryArtistNames =
      api?.lineupEntries?.flatMap((entry) => entry.artists) ?? [];

    const modelConsistency = classifyModelConsistency({
      structuredEntryCount: structured.length,
      structuredArtistNames,
      legacyArtistNames,
      apiLineupEntryCount: api?.lineupEntries?.length ?? 0,
      apiArtistNames,
    });

    const allProjectedArtistNames = [
      ...legacyArtistNames,
      ...structuredArtistNames,
      ...apiArtistNames,
      ...apiLineupEntryArtistNames,
    ];
    const invalidArtistNames = [...new Set(allProjectedArtistNames)].filter((name) =>
      isSuspiciousArtistName(name),
    );
    const collapsedArtistNames = findCollapsedNames(allProjectedArtistNames);
    const titleInferenceArtists = primaryImport
      ? extractTitleDerivedArtistNames(primaryImport).filter((name) =>
          legacyArtistNames.some((legacyName) => legacyName.toLowerCase().includes(name.toLowerCase())),
        )
      : [];

    const trace: EventLineupTraceRow = {
      eventId: event.id,
      title: event.title,
      startDate: event.start_date ?? undefined,
      venueName: event.venue_name ?? undefined,
      organizerName: Array.isArray(event.organizers)
        ? event.organizers[0]?.name
        : (event.organizers as { name?: string } | null)?.name,
      status: event.status,
      originIds: origins.map((origin) => origin.sourceId),
      sourceIds: [...new Set([event.source_id, ...imports.map((record) => record.sourceId)].filter(Boolean))],
      sourceConnectors: imports.map(
        (record) =>
          ((record.normalizedPayload as { sourceMetadata?: { connector?: string } })?.sourceMetadata
            ?.connector as string | undefined) ?? record.sourceType ?? 'unknown',
      ),
      sourceExternalIds: imports.map((record) => record.externalId),
      sourceUrls: [
        event.website_url,
        event.ticket_url,
        ...imports.map((record) => record.sourceUrl),
        ...origins.map((origin) => origin.url),
      ].filter((url): url is string => Boolean(url)),
      imageUrl: event.image_url ?? undefined,
      importRecordIds: imports.map((record) => record.id),
      rawArtistNames: candidate?.artistNames ?? [],
      rawDescriptionSnippet: candidate?.description?.slice(0, 240),
      normalizedArtistNames: simulated.entries.flatMap((entry) => entry.artists),
      simulatedLineupEntriesCount: simulated.entries.length,
      structuredEntryCount: structured.length,
      structuredBillingRelations: structured.map((entry) => entry.billingRelation),
      structuredArtistNames,
      legacyArtistNames,
      legacyArtistIds: legacy.map((row) => row.artistId),
      apiLineupEntryCount: api?.lineupEntries?.length ?? 0,
      apiArtistNames,
      apiLineupEntryArtistNames,
      modelConsistency,
      invalidArtistSignals: invalidArtistNames.flatMap((name) => detectInvalidArtistSignals(name)),
      collapsedArtistNames,
      titleInferenceArtists,
      titleInferenceClass:
        titleInferenceArtists[0] && event.title
          ? classifyTitleInference(event.title, titleInferenceArtists[0])
          : undefined,
      flyerEvidencePresent: Boolean(flyerEvidence),
      flyerEvidenceReviewState: flyerEvidence?.reviewState,
      detailBlocked: lineupMeta.detailBlocked ?? false,
      firstFailureStage: 'pending',
      rootCauseClass: null,
      pipelineHealthy: false,
      genericFixClass: 'pending',
      requiresMutation: false,
      requiresReimport: false,
      requiresManualReview: false,
      confidence: 0.5,
    };

    const classified = classifyEventRootCause({
      eventId: event.id,
      title: event.title,
      modelConsistency,
      invalidArtistNames,
      collapsedArtistNames,
      titleInferenceArtists,
      flyerEvidencePresent: Boolean(flyerEvidence),
      detailBlocked: lineupMeta.detailBlocked ?? false,
      structuredEntryCount: structured.length,
      legacyArtistNames,
      rawArtistNames: trace.rawArtistNames,
    });

    trace.firstFailureStage = classified.firstFailureStage;
    trace.rootCauseClass = classified.rootCauseClass;
    trace.pipelineHealthy = classified.pipelineHealthy ?? false;
    trace.genericFixClass = classified.genericFixClass;
    trace.requiresMutation = classified.genericFixClass !== 'none' && !trace.pipelineHealthy;
    trace.requiresReimport =
      classified.rootCauseClass !== null &&
      ['H_TITLE_INFERENCE_PROMOTED', 'G_DESCRIPTION_AS_LINEUP', 'B_CROSS_EVENT_STATE_LEAKAGE'].includes(
        classified.rootCauseClass,
      );
    trace.requiresManualReview =
      classified.rootCauseClass !== null &&
      (classified.rootCauseClass === 'Q_FLYER_EVIDENCE_REQUIRED' ||
        classified.rootCauseClass === 'J_ARTIST_RESOLUTION_ALIAS_ERROR');
    trace.confidence =
      modelConsistency === 'fully_aligned' && invalidArtistNames.length === 0 ? 0.95 : 0.75;

    traces.push(trace);
  }

  return traces;
}

function detectContamination(traces: EventLineupTraceRow[]): unknown[] {
  const cases: unknown[] = [];
  const byLegacy = new Map<string, EventLineupTraceRow[]>();

  for (const trace of traces) {
    if (trace.legacyArtistNames.length > 2) {
      const key = lineupFingerprint(trace.legacyArtistNames);
      const list = byLegacy.get(key) ?? [];
      list.push(trace);
      byLegacy.set(key, list);
    }
  }

  for (const [fingerprint, group] of byLegacy.entries()) {
    if (group.length < 2) continue;
    for (let index = 0; index < group.length; index += 1) {
      for (let other = index + 1; other < group.length; other += 1) {
        const a = group[index]!;
        const b = group[other]!;
        if (a.eventId === b.eventId) continue;
        cases.push({
          type: 'identical_legacy_lineup_fingerprint',
          fingerprint,
          eventA: { id: a.eventId, title: a.title },
          eventB: { id: b.eventId, title: b.title },
          firstFailureStage: '9_multi_origin_event_matching',
          codePath: 'import/publish + event_artists projection',
          persisted: true,
          evidence: 'identical legacy artist name ordering',
        });
        a.contaminationSuspect = {
          otherEventId: b.eventId,
          otherEventTitle: b.title,
          sharedEvidence: `legacy fingerprint ${fingerprint}`,
        };
        b.contaminationSuspect = {
          otherEventId: a.eventId,
          otherEventTitle: a.title,
          sharedEvidence: `legacy fingerprint ${fingerprint}`,
        };
      }
    }
  }

  for (let index = 0; index < traces.length; index += 1) {
    for (let other = index + 1; other < traces.length; other += 1) {
      const a = traces[index]!;
      const b = traces[other]!;
      if (a.structuredArtistNames.length < 5 || b.structuredArtistNames.length < 5) {
        continue;
      }
      const overlap = lineupOverlapRatio(a.structuredArtistNames, b.structuredArtistNames);
      if (overlap < 0.85) {
        continue;
      }
      if (normalizeMatchText(a.title) === normalizeMatchText(b.title)) {
        continue;
      }
      cases.push({
        type: 'high_structured_lineup_overlap',
        overlap,
        eventA: { id: a.eventId, title: a.title, artistCount: a.structuredArtistNames.length },
        eventB: { id: b.eventId, title: b.title, artistCount: b.structuredArtistNames.length },
        sharedArtists: a.structuredArtistNames.filter((name) =>
          b.structuredArtistNames.some(
            (otherName) => normalizeMatchText(otherName) === normalizeMatchText(name),
          ),
        ),
        firstFailureStage: '9_multi_origin_event_matching',
        codePath:
          'import_record.resulting_event_id mismatch or enrichment duplicate publish copied lineup',
        persisted: true,
        evidence: `${Math.round(overlap * 100)}% structured artist overlap between unrelated titles`,
      });
      if (!a.contaminationSuspect) {
        a.contaminationSuspect = {
          otherEventId: b.eventId,
          otherEventTitle: b.title,
          sharedEvidence: `structured overlap ${overlap.toFixed(2)}`,
        };
      }
      if (!b.contaminationSuspect) {
        b.contaminationSuspect = {
          otherEventId: a.eventId,
          otherEventTitle: a.title,
          sharedEvidence: `structured overlap ${overlap.toFixed(2)}`,
        };
      }
    }
  }

  return cases;
}

function collectInvalidArtists(traces: EventLineupTraceRow[]): unknown[] {
  const rows: unknown[] = [];
  const seen = new Set<string>();
  for (const trace of traces) {
    for (const name of [...trace.legacyArtistNames, ...trace.structuredArtistNames]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      const signals = detectInvalidArtistSignals(name);
      if (signals.length === 0) continue;
      seen.add(key);
      rows.push({
        artistName: name,
        signals,
        linkedEventIds: traces
          .filter(
            (candidate) =>
              candidate.legacyArtistNames.includes(name) ||
              candidate.structuredArtistNames.includes(name),
          )
          .map((candidate) => candidate.eventId),
        likelySourceField: 'description or artistNames fallback',
        likelyParserPath: 'lineup-text-parser / import-lineup-from-record',
        qualityGateBypassed: signals.includes('placeholder_not_rejected'),
        eventTitles: traces
          .filter((candidate) => candidate.legacyArtistNames.includes(name))
          .map((candidate) => candidate.title),
      });
    }
  }
  return rows;
}

function collectMismatches(traces: EventLineupTraceRow[]): unknown[] {
  return traces
    .filter((trace) => trace.modelConsistency !== 'fully_aligned')
    .map((trace) => ({
      eventId: trace.eventId,
      title: trace.title,
      modelConsistency: trace.modelConsistency,
      structuredEntryCount: trace.structuredEntryCount,
      legacyCount: trace.legacyArtistNames.length,
      apiLineupEntryCount: trace.apiLineupEntryCount,
      apiArtistCount: trace.apiArtistNames.length,
      structuredArtists: trace.structuredArtistNames,
      legacyArtists: trace.legacyArtistNames,
      apiArtists: trace.apiArtistNames,
    }));
}

function countRootCauses(traces: EventLineupTraceRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trace of traces) {
    if (trace.pipelineHealthy || trace.rootCauseClass === null) {
      continue;
    }
    counts[trace.rootCauseClass] = (counts[trace.rootCauseClass] ?? 0) + 1;
  }
  return counts;
}

function buildMetrics(traces: EventLineupTraceRow[]): Record<string, number> {
  return {
    totalPublishedEvents: traces.length,
    structuredLineupPresent: traces.filter((trace) => trace.structuredEntryCount > 0).length,
    structuredLineupAbsent: traces.filter((trace) => trace.structuredEntryCount === 0).length,
    legacyLineupPresent: traces.filter((trace) => trace.legacyArtistNames.length > 0).length,
    structuredLegacyMismatch: traces.filter((trace) => trace.modelConsistency !== 'fully_aligned').length,
    proseBlobArtists: traces.filter((trace) => trace.invalidArtistSignals.length > 0).length,
    collapsedNameEvents: traces.filter((trace) => trace.collapsedArtistNames.length > 0).length,
    titleDerivedEvents: traces.filter((trace) => trace.titleInferenceArtists.length > 0).length,
    flyerEvidenceAvailable: traces.filter((trace) => trace.flyerEvidencePresent).length,
    detailBlocked: traces.filter((trace) => trace.detailBlocked).length,
    contaminationSuspects: traces.filter((trace) => trace.contaminationSuspect).length,
    pipelineHealthyCount: traces.filter((trace) => trace.pipelineHealthy).length,
    activeParserPaths: PARSER_PATH_INVENTORY.length,
    activeWriterPaths: WRITER_PATH_INVENTORY.length,
  };
}

function buildMinimumFixPlan(rootCauseCounts: Record<string, number>): unknown {
  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    priorities: [
      {
        priority: 'P0',
        fixes: [
          {
            id: 'event_ownership_isolation',
            rootCauses: ['A_WRONG_SOURCE_EVENT_MATCH', 'B_CROSS_EVENT_STATE_LEAKAGE'],
            affectedCount:
              (rootCauseCounts.A_WRONG_SOURCE_EVENT_MATCH ?? 0) +
              (rootCauseCounts.B_CROSS_EVENT_STATE_LEAKAGE ?? 0),
            modules: ['import/matching', 'import-event-publish-service', 'lineup-projection-integrity'],
            migrationRequired: false,
            productionRepairRequired: true,
            rollback: 'restore import match + lineup from backup',
          },
          {
            id: 'block_prose_artist_creation',
            rootCauses: ['G_DESCRIPTION_AS_LINEUP', 'I_ARTIST_QUALITY_GATE_BYPASSED'],
            affectedCount:
              (rootCauseCounts.G_DESCRIPTION_AS_LINEUP ?? 0) +
              (rootCauseCounts.I_ARTIST_QUALITY_GATE_BYPASSED ?? 0),
            modules: ['lineup-text-parser', 'import-title-lineup-resolver', 'lineup-artist-quality'],
            migrationRequired: false,
            productionRepairRequired: true,
            rollback: 'detach invalid event_artists links; mark legacy artifacts',
          },
        ],
      },
      {
        priority: 'P1',
        fixes: [
          {
            id: 'single_structured_writer',
            rootCauses: ['L_STRUCTURED_PERSISTENCE_SKIPPED', 'M_LEGACY_COMPATIBILITY_CORRUPTION'],
            affectedCount:
              (rootCauseCounts.L_STRUCTURED_PERSISTENCE_SKIPPED ?? 0) +
              (rootCauseCounts.M_LEGACY_COMPATIBILITY_CORRUPTION ?? 0),
            modules: ['import-publish-lineup-writer', 'event-lineup-service'],
            migrationRequired: false,
            productionRepairRequired: true,
            rollback: 're-run structured writer from import evidence',
          },
          {
            id: 'demote_title_inference',
            rootCauses: ['H_TITLE_INFERENCE_PROMOTED'],
            affectedCount: rootCauseCounts.H_TITLE_INFERENCE_PROMOTED ?? 0,
            modules: ['import-publish-lineup-writer', 'import-title-lineup-resolver'],
            migrationRequired: false,
            productionRepairRequired: true,
            rollback: 'remove title-derived artists from affected events',
          },
        ],
      },
      {
        priority: 'P2',
        fixes: [
          {
            id: 'sync_compatibility_projection',
            rootCauses: ['M_LEGACY_COMPATIBILITY_CORRUPTION', 'N_API_PROJECTION_MIXED'],
            affectedCount:
              (rootCauseCounts.M_LEGACY_COMPATIBILITY_CORRUPTION ?? 0) +
              (rootCauseCounts.N_API_PROJECTION_MIXED ?? 0),
            modules: ['structured-lineup-primary', 'supabase-datasource'],
            migrationRequired: false,
            productionRepairRequired: true,
            rollback: 're-derive event_artists from structured entries',
          },
        ],
      },
      {
        priority: 'P3',
        fixes: [
          {
            id: 'flyer_reconciliation_when_blocked',
            rootCauses: ['Q_FLYER_EVIDENCE_REQUIRED', 'C_DETAIL_SOURCE_INACCESSIBLE', 'E_HTML_STRUCTURE_LOST'],
            affectedCount:
              (rootCauseCounts.Q_FLYER_EVIDENCE_REQUIRED ?? 0) +
              (rootCauseCounts.C_DETAIL_SOURCE_INACCESSIBLE ?? 0) +
              (rootCauseCounts.E_HTML_STRUCTURE_LOST ?? 0),
            modules: ['flyer-evidence-metadata', 'import-structured-lineup-from-record'],
            migrationRequired: false,
            productionRepairRequired: true,
            rollback: 'restore lineup backup; reject flyer evidence',
          },
        ],
      },
    ],
  };
}

function buildRepresentativeTraces(traces: EventLineupTraceRow[]): unknown[] {
  return REPRESENTATIVE_TITLE_PATTERNS.map((spec) => {
    const match =
      traces.find((trace) => spec.pattern.test(trace.title)) ??
      traces.find((trace) => spec.label.toLowerCase().includes(trace.title.toLowerCase().slice(0, 12)));
    if (!match) {
      return { label: spec.label, found: false };
    }
    return {
      label: spec.label,
      found: true,
      eventId: match.eventId,
      title: match.title,
      firstFailureStage: match.firstFailureStage,
      rootCauseClass: match.rootCauseClass,
      genericFixClass: match.genericFixClass,
      modelConsistency: match.modelConsistency,
      contaminationSuspect: match.contaminationSuspect,
      structuredEntries: match.structuredEntryCount,
      structuredArtists: match.structuredArtistNames,
      legacyArtists: match.legacyArtistNames,
      apiArtists: match.apiArtistNames,
      apiLineupEntries: match.apiLineupEntryCount,
      invalidArtists: match.collapsedArtistNames.length > 0 ? match.collapsedArtistNames : match.legacyArtistNames.filter(isSuspiciousArtistName),
      importRecordIds: match.importRecordIds,
      detailBlocked: match.detailBlocked,
      flyerEvidencePresent: match.flyerEvidencePresent,
    };
  });
}

function buildReport(state: AuditState): string {
  const topCauses = Object.entries(state.rootCauseCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);

  return [
    '# Phase 4.6.9 — Global Lineup Pipeline Audit',
    '',
    `Generated: ${state.generatedAt}`,
    '',
    '**Mode: READ-ONLY** — no production mutations performed.',
    '',
    '## Executive summary',
    '',
    `- Published events traced: **${state.metrics.totalPublishedEvents}**`,
    `- Structured/legacy mismatches: **${state.metrics.structuredLegacyMismatch}**`,
    `- Cross-event contamination suspects: **${state.metrics.contaminationSuspects}**`,
    `- Events with prose/blob artists: **${state.metrics.proseBlobArtists}**`,
    `- Events with collapsed names: **${state.metrics.collapsedNameEvents}**`,
    `- Pipeline healthy (no current failure): **${state.metrics.pipelineHealthyCount ?? 0}**`,
    '',
    '## Top root causes (incorrect/incomplete events only)',
    '',
    ...topCauses.map(([cause, count]) => `- \`${cause}\`: ${count}`),
    '',
    '## Key findings',
    '',
    '### Into The Madness / MDMA contamination',
    '**Root cause: `B_CROSS_EVENT_STATE_LEAKAGE` at stage 9 (multi-origin event matching).**',
    '',
    'Event `evt-1785339386612-rjr91mv` (Into The Madness Pre-Party) carries MDMA Ticket Kings import records:',
    '- `source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt` in originIds',
    '- `sourceExternalIds` include `ticketkings.de/event/mdma-musik-die-mich-antreibt-...` (3×) alongside correct Bootshaus URLs',
    '- `rawDescriptionSnippet` is the MDMA event copy (“MDMA- Musik Die Mich Antreibt… Line Up: DYSTOPIA F2F VALKYRIE…”)',
    '- 100% structured artist overlap with MDMA canonical event `evt-1785389054496-ns9b6la` (18 shared artists)',
  '',
    'The wrong Source payload was matched/published onto the Pre-Party canonical Event; parser output is internally consistent with MDMA Source evidence, not Bootshaus Pre-Party evidence.',
    '',
    '### KitKatClub description-as-artist',
    '**Root cause: `G_DESCRIPTION_AS_LINEUP` at stage 6/11.** Venue description HTML (`&bdquo;`, `&ldquo;`, prose sentences) ingested as flat `artistNames` when list-page detail lacks structured lineup sections. Quality gate `isLineupPlaceholderArtist` does not reject prose fragments. Same description fingerprint shared across two KitKat dates (22.08 and 24.10).',
    '',
    '### Bootshaus collapsed B2B',
    '**Vol. III (repaired):** structured 4×B2B entries correct via flyer evidence. **Vol. IV:** collapsed API artist blob with admission text (`G_DESCRIPTION_AS_LINEUP` / `E_HTML_STRUCTURE_LOST` compound) — whitespace collapse in HTML-to-text before billing segmentation; no structured persistence.',
    '',
    '### Import/repair oscillation',
    'Multiple import records per event + dual writers (`import-publish-lineup-writer` flat fallback vs structured writer) can alternate flat 5-artist collapsed state with 8-artist structured state.',
    '',
    '## Pipeline stages',
    '',
    ...LINEUP_PIPELINE_STAGES.map(
      (stage) =>
        `${stage.order}. **${stage.name}** — \`${stage.module}\` (${stage.mutationBehavior})`,
    ),
    '',
    '## Minimum fix plan',
    '',
    'See `docs/real-data/_phase469_minimum_fix_plan.json` for ordered P0–P3 generic fixes.',
    '',
    '## Deliverables',
    '',
    '- `_phase469_global_event_trace_matrix.json`',
    '- `_phase469_cross_event_contamination.json`',
    '- `_phase469_invalid_artist_entities.json`',
    '- `_phase469_structured_legacy_mismatches.json`',
    '- `_phase469_parser_path_inventory.json`',
    '- `_phase469_writer_path_inventory.json`',
    '- `_phase469_representative_traces.json`',
    '- `_phase469_root_cause_counts.json`',
    '',
  ].join('\n');
}

async function runFullAudit(): Promise<AuditState> {
  ensureOutDir();
  const traces = await buildEventTraces();
  const contamination = detectContamination(traces);
  for (const trace of traces) {
    if (trace.contaminationSuspect) {
      const classified = classifyEventRootCause({
        eventId: trace.eventId,
        title: trace.title,
        modelConsistency: trace.modelConsistency,
        invalidArtistNames: [
          ...new Set([
            ...trace.legacyArtistNames,
            ...trace.structuredArtistNames,
            ...trace.apiArtistNames,
            ...trace.apiLineupEntryArtistNames,
          ]),
        ].filter(isSuspiciousArtistName),
        collapsedArtistNames: trace.collapsedArtistNames,
        titleInferenceArtists: trace.titleInferenceArtists,
        flyerEvidencePresent: trace.flyerEvidencePresent,
        detailBlocked: trace.detailBlocked,
        structuredEntryCount: trace.structuredEntryCount,
        legacyArtistNames: trace.legacyArtistNames,
        rawArtistNames: trace.rawArtistNames,
        contaminationSuspect: trace.contaminationSuspect,
      });
      trace.rootCauseClass = classified.rootCauseClass;
      trace.firstFailureStage = classified.firstFailureStage;
      trace.genericFixClass = classified.genericFixClass;
      trace.pipelineHealthy = classified.pipelineHealthy ?? false;
    }
  }

  const invalidArtists = collectInvalidArtists(traces);
  const mismatches = collectMismatches(traces);
  const rootCauseCounts = countRootCauses(traces);
  const metrics = buildMetrics(traces);
  const fixPlan = buildMinimumFixPlan(rootCauseCounts);
  const representatives = buildRepresentativeTraces(traces);

  const state: AuditState = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    traces,
    contamination,
    invalidArtists,
    mismatches,
    rootCauseCounts,
    metrics,
  };

  writeJson(OUT_MATRIX, { generatedAt: state.generatedAt, readOnly: true, events: traces });
  writeJson(OUT_CONTAMINATION, { generatedAt: state.generatedAt, readOnly: true, cases: contamination });
  writeJson(OUT_INVALID_ARTISTS, { generatedAt: state.generatedAt, readOnly: true, artists: invalidArtists });
  writeJson(OUT_MISMATCHES, { generatedAt: state.generatedAt, readOnly: true, mismatches });
  writeJson(OUT_PARSER, { generatedAt: state.generatedAt, readOnly: true, stages: LINEUP_PIPELINE_STAGES, parsers: PARSER_PATH_INVENTORY });
  writeJson(OUT_WRITERS, { generatedAt: state.generatedAt, readOnly: true, writers: WRITER_PATH_INVENTORY });
  writeJson(OUT_TRACES, { generatedAt: state.generatedAt, readOnly: true, representatives });
  writeJson(OUT_ROOT_CAUSES, { generatedAt: state.generatedAt, readOnly: true, counts: rootCauseCounts, metrics });
  writeJson(OUT_FIX_PLAN, fixPlan);
  writeFileSync(OUT_REPORT, buildReport(state));

  return state;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';
  console.log(`Phase 4.6.9 global lineup audit — READ-ONLY mode (${command})`);

  if (command === 'inventory') {
    ensureOutDir();
    writeJson(OUT_PARSER, { stages: LINEUP_PIPELINE_STAGES, parsers: PARSER_PATH_INVENTORY });
    writeJson(OUT_WRITERS, { writers: WRITER_PATH_INVENTORY });
    console.log('Inventory written.');
    return;
  }

  const state = await runFullAudit();

  if (command === 'trace') {
    console.log(`Trace matrix: ${state.traces.length} events → ${OUT_MATRIX}`);
    return;
  }
  if (command === 'contamination') {
    console.log(`Contamination cases: ${state.contamination.length} → ${OUT_CONTAMINATION}`);
    return;
  }
  if (command === 'invalid-artists') {
    console.log(`Invalid artist rows: ${state.invalidArtists.length} → ${OUT_INVALID_ARTISTS}`);
    return;
  }
  if (command === 'model-consistency') {
    console.log(`Mismatches: ${state.mismatches.length} → ${OUT_MISMATCHES}`);
    return;
  }
  if (command === 'root-causes') {
    console.log(`Root causes → ${OUT_ROOT_CAUSES}`);
    return;
  }
  if (command === 'report' || command === 'full') {
    console.log(`Report → ${OUT_REPORT}`);
    console.log(`Metrics: ${JSON.stringify(state.metrics)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
