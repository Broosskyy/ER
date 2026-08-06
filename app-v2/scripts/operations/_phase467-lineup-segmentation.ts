/**
 * Phase 4.6.7 — Lineup segmentation audit, artist integrity repair and report.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase467-lineup-segmentation.ts [phase]
 *
 * Phases: audit | backup | repair | pass2 | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countBillingRelationshipsInName,
  expandLineupArtistName,
  isCollapsedLineupArtistName,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { resolveLineupRootCause } from '@/features/aggregation/domain/lineup-root-cause';
import {
  isLineupPlaceholderArtist,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { pickBestImportRecordForLineupRepair } from '@/features/import/services/lineup-projection-integrity';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_INTEGRITY = join(ROOT, 'docs/real-data/_phase467_artist_integrity.json');
const OUT_REPAIRS = join(ROOT, 'docs/real-data/_phase467_lineup_repairs.json');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase467_lineup_backup.json');
const OUT_BEFORE = join(ROOT, 'docs/real-data/_phase467_metrics_before.json');
const OUT_AFTER = join(ROOT, 'docs/real-data/_phase467_metrics_after.json');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase467_lineup_state.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_467_LINEUP_SEGMENTATION_REPORT.md');

const REPRESENTATIVE_PATTERNS = [
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest\s+elektroküche/i },
  { label: 'Bootshaus on a Ship Vol. III', pattern: /bootshaus\s+on\s+a\s+ship\s+vol\.\s*iii/i },
  { label: 'MDMA', pattern: /\bmdma\b/i },
  { label: 'LEVI', pattern: /\blevi\b/i },
];

const PIPELINE_STAGES = [
  'description_parser',
  'lineup_parser',
  'tokenizer',
  'billing_parser',
  'artist_normalization',
  'canonical_projection',
  'consumer_projection',
] as const;

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
    importRecordRepository: registry.importRecordRepository,
    importEventPublishService: registry.importEventPublishService,
    adminArtistRepository: registry.adminArtistRepository,
    eventRepository: registry.eventRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

interface EventLineupSnapshot {
  eventId: string;
  title: string;
  canonicalArtists: string[];
  importArtists: string[];
  invalidArtists: string[];
  collapsedArtists: string[];
  shouldRepair: boolean;
  repairReason?: string;
  failureStage?: string;
  confidence: 'high' | 'medium' | 'low';
}

async function snapshotEventLineup(
  event: { id: string; title: string; description?: string | null },
  artistsById: Map<string, string>,
): Promise<EventLineupSnapshot> {
  const c = opsClient();
  const { data: imports } = await c
    .from('import_records')
    .select('id,source_id,normalized_payload,external_id')
    .eq('resulting_event_id', event.id);
  const { data: ea } = await c
    .from('event_artists')
    .select('artist_id,sort_order')
    .eq('event_id', event.id)
    .order('sort_order');

  const canonicalArtists = (ea ?? []).map((row) => artistsById.get(row.artist_id) ?? row.artist_id);
  const invalidArtists = canonicalArtists.filter((name) => isLineupPlaceholderArtist(name));
  const collapsedArtists = canonicalArtists.filter((name) => isCollapsedLineupArtistName(name));

  const importTraces = (imports ?? []).map((imp) => {
    const record = {
      id: imp.id,
      sourceId: imp.source_id,
      normalizedPayload: imp.normalized_payload,
      status: 'imported',
      externalId: imp.external_id,
    } as ImportRecord;
    const prioritized = extractPrioritizedArtistNames(record);
    return {
      sourceId: imp.source_id,
      prioritizedNames: prioritized.names,
      prioritizedSource: prioritized.source,
    };
  });

  const importArtists = sanitizeLineupArtistNames(
    importTraces.flatMap((trace) => trace.prioritizedNames),
  ) ?? [];

  const rootCause = resolveLineupRootCause({
    eventId: event.id,
    title: event.title,
    description: event.description ?? undefined,
    validCanonicalCount: canonicalArtists.filter((n) => !isLineupPlaceholderArtist(n)).length,
    invalidCanonicalNames: invalidArtists,
    canonicalArtistNames: sanitizeLineupArtistNames(canonicalArtists) ?? [],
    importTraces,
  });

  const existingIds = (ea ?? []).map((row) => row.artist_id);
  let shouldRepair = collapsedArtists.length > 0 || invalidArtists.length > 0;
  let repairReason = collapsedArtists.length > 0 ? 'collapsed_canonical_artists' : 'invalid_canonical_artists';

  if (!shouldRepair && imports?.length) {
    const records: ImportRecord[] = imports.map(
      (imp) =>
        ({
          id: imp.id,
          sourceId: imp.source_id,
          normalizedPayload: imp.normalized_payload,
          status: 'imported',
          externalId: imp.external_id,
        }) as ImportRecord,
    );
    const artistsByIdRecords = new Map(
      [...artistsById.entries()].map(([id, name]) => [id, { name }] as const),
    );
    const picked = pickBestImportRecordForLineupRepair(records, existingIds, artistsByIdRecords);
    if (picked?.assessment.shouldRepair) {
      shouldRepair = true;
      repairReason = picked.assessment.reason;
    }
  }

  const failureStage =
    collapsedArtists.length > 0
      ? 'canonical_projection'
      : rootCause.firstFailureStage
        ? PIPELINE_STAGES[rootCause.firstFailureStage - 1]
        : undefined;

  const confidence: EventLineupSnapshot['confidence'] =
    importArtists.length > 0 && collapsedArtists.length > 0
      ? 'high'
      : importArtists.length > 0
        ? 'medium'
        : 'low';

  return {
    eventId: event.id,
    title: event.title,
    canonicalArtists,
    importArtists,
    invalidArtists,
    collapsedArtists,
    shouldRepair,
    repairReason,
    failureStage,
    confidence,
  };
}

async function collectMetrics(): Promise<Record<string, number>> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title,description').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name] as const));

  let completeLineups = 0;
  let singleArtistEvents = 0;
  let invalidArtistEntities = 0;
  let brokenBillingRelationships = 0;
  let totalArtists = 0;

  for (const event of events ?? []) {
    const snapshot = await snapshotEventLineup(event, artistsById);
    const valid = snapshot.canonicalArtists.filter((n) => !isLineupPlaceholderArtist(n));
    if (valid.length > 0) {
      completeLineups += 1;
      totalArtists += valid.length;
      if (valid.length === 1) {
        singleArtistEvents += 1;
      }
    }
    invalidArtistEntities += snapshot.invalidArtists.length + snapshot.collapsedArtists.length;
    brokenBillingRelationships += snapshot.collapsedArtists.reduce(
      (sum, name) => sum + countBillingRelationshipsInName(name),
      0,
    );
  }

  const collapsedCanonical = (artists ?? []).filter((a) => isCollapsedLineupArtistName(a.name)).length;

  return {
    publishedEvents: events?.length ?? 0,
    completeLineups,
    singleArtistEvents,
    invalidArtistEntities,
    averageArtistsPerEvent:
      completeLineups > 0 ? Math.round((totalArtists / completeLineups) * 100) / 100 : 0,
    brokenBillingRelationships,
    canonicalArtistCount: artists?.length ?? 0,
    collapsedCanonicalArtistEntities: collapsedCanonical,
  };
}

async function runAudit(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title,description').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name] as const));

  const eventSnapshots: EventLineupSnapshot[] = [];
  const segmentationAudit: unknown[] = [];
  const invalidArtistCatalog: unknown[] = [];

  for (const artist of artists ?? []) {
    if (!isCollapsedLineupArtistName(artist.name)) {
      continue;
    }
    invalidArtistCatalog.push({
      artistId: artist.id,
      name: artist.name,
      expanded: expandLineupArtistName(artist.name),
      billingTokenCount: countBillingRelationshipsInName(artist.name),
    });
  }

  for (const event of events ?? []) {
    const snapshot = await snapshotEventLineup(event, artistsById);
    eventSnapshots.push(snapshot);

    if (snapshot.collapsedArtists.length > 0 || snapshot.invalidArtists.length > 0) {
      segmentationAudit.push({
        eventId: snapshot.eventId,
        title: snapshot.title,
        failureStage: snapshot.failureStage ?? 'canonical_projection',
        collapsedArtists: snapshot.collapsedArtists,
        invalidArtists: snapshot.invalidArtists,
        importArtists: snapshot.importArtists,
        canonicalArtists: snapshot.canonicalArtists,
        repairedStage: 'audit_only',
        confidence: snapshot.confidence,
      });
    }
  }

  const representatives: unknown[] = [];
  for (const rep of REPRESENTATIVE_PATTERNS) {
    const match = eventSnapshots.find((row) => rep.pattern.test(row.title));
    if (!match) {
      representatives.push({ label: rep.label, found: false });
      continue;
    }
    representatives.push({
      label: rep.label,
      found: true,
      eventId: match.eventId,
      title: match.title,
      canonicalArtists: match.canonicalArtists,
      importArtists: match.importArtists,
      shouldRepair: match.shouldRepair,
    });
  }

  const beforeMetrics = await collectMetrics();
  writeFileSync(
    OUT_BEFORE,
    JSON.stringify({ generatedAt: new Date().toISOString(), metrics: beforeMetrics }, null, 2),
  );

  writeFileSync(
    OUT_INTEGRITY,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        pipelineStages: PIPELINE_STAGES,
        segmentationAudit,
        invalidArtistCatalog,
        representatives,
        metrics: beforeMetrics,
        repairCandidates: eventSnapshots.filter((row) => row.shouldRepair).length,
      },
      null,
      2,
    ),
  );

  state.audit = {
    generatedAt: new Date().toISOString(),
    repairCandidates: eventSnapshots.filter((row) => row.shouldRepair).length,
    invalidArtistCatalogCount: invalidArtistCatalog.length,
    metrics: beforeMetrics,
  };
  saveState();
  console.log(`Audit complete. Repair candidates: ${state.audit.repairCandidates}`);
}

async function runBackup(): Promise<void> {
  const integrity = existsSync(OUT_INTEGRITY)
    ? (JSON.parse(readFileSync(OUT_INTEGRITY, 'utf8')) as {
        segmentationAudit: Array<{ eventId: string }>;
      })
    : { segmentationAudit: [] };
  const eventIds = integrity.segmentationAudit.map((row) => row.eventId);
  const c = opsClient();
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
    backupEvents.push({ eventId, event, eventArtists: ea ?? [], importRecords: imports ?? [] });
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
    importRecordRepository,
    importEventPublishService,
    adminArtistRepository,
    eventRepository,
    initializeEntityAliasStore,
    flushEntityAliasStore,
  } = await loadRegistry();
  await initializeEntityAliasStore();

  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title,description').eq('status', 'published');
  const artists = await adminArtistRepository.getAll();
  const artistsById = new Map(artists.map((a) => [a.id, a] as const));

  const results: unknown[] = [];
  for (const event of events ?? []) {
    const before = await snapshotEventLineup(event, new Map(artists.map((a) => [a.id, a.name])));

    if (!before.shouldRepair) {
      continue;
    }

    const { data: importRows } = await c
      .from('import_records')
      .select('id')
      .eq('resulting_event_id', event.id);
    const records: ImportRecord[] = [];
    for (const row of importRows ?? []) {
      const record = await importRecordRepository.getById(row.id);
      if (record) records.push(record);
    }

    const existingIds = (
      await c.from('event_artists').select('artist_id').eq('event_id', event.id).order('sort_order')
    ).data?.map((row) => row.artist_id) ?? [];

    const picked = pickBestImportRecordForLineupRepair(records, existingIds, artistsById);
    if (!picked?.assessment.shouldRepair && before.collapsedArtists.length === 0 && before.invalidArtists.length === 0) {
      continue;
    }

    const record = picked?.record ?? records[0];
    if (!record) {
      continue;
    }

    const repair = await importEventPublishService.repairLineupProjection(record, event.id);
    const after = await snapshotEventLineup(event, new Map(artists.map((a) => [a.id, a.name])));

    const changed =
      JSON.stringify(before.canonicalArtists) !== JSON.stringify(after.canonicalArtists) ||
      repair.wroteLineup;

    if (!changed && passLabel === 'pass2') {
      continue;
    }

    results.push({
      pass: passLabel,
      eventId: event.id,
      title: event.title,
      reason: before.repairReason,
      repairedStage: before.failureStage ?? 'canonical_projection',
      confidence: before.confidence,
      before: {
        canonicalArtists: before.canonicalArtists,
        collapsedArtists: before.collapsedArtists,
        invalidArtists: before.invalidArtists,
      },
      after: {
        canonicalArtists: after.canonicalArtists,
        collapsedArtists: after.collapsedArtists,
        invalidArtists: after.invalidArtists,
        artistCount: repair.artistIds.length,
      },
      wroteLineup: repair.wroteLineup,
    });
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);

  const existingRepairs = existsSync(OUT_REPAIRS)
    ? (JSON.parse(readFileSync(OUT_REPAIRS, 'utf8')) as { passes?: unknown[] }).passes ?? []
    : [];

  writeFileSync(
    OUT_REPAIRS,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        passes: [...existingRepairs, { pass: passLabel, completedAt: new Date().toISOString(), results }],
      },
      null,
      2,
    ),
  );

  state[passLabel] = { completedAt: new Date().toISOString(), repaired: results.length, results };
  saveState();
  console.log(`[${passLabel}] repaired events: ${results.length}`);
}

function buildReport(): void {
  const audit = state.audit as { metrics?: Record<string, number> } | undefined;
  const pass1 = state.pass1 as { repaired?: number } | undefined;
  const pass2 = state.pass2 as { repaired?: number } | undefined;
  const afterMetrics = existsSync(OUT_AFTER)
    ? (JSON.parse(readFileSync(OUT_AFTER, 'utf8')) as { metrics?: Record<string, number> }).metrics
    : undefined;
  const integrity = existsSync(OUT_INTEGRITY)
    ? (JSON.parse(readFileSync(OUT_INTEGRITY, 'utf8')) as Record<string, unknown>)
    : {};

  const lines = [
    '# Phase 4.6.7 — Lineup Segmentation & Canonical Artist Integrity',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Segmentation audit',
    '',
    'Pipeline traced: Text → description parser → lineup parser → tokenizer → billing parser → artist normalization → canonical projection → consumer projection.',
    'Collapsed canonical artist entities indicate failure at **billing_parser** or **canonical_projection** when import payloads already contain segmented artists.',
    '',
    `Repair candidates: ${(audit?.metrics as Record<string, number> | undefined)?.invalidArtistEntities ?? 'n/a'}`,
    '',
    '## 2. Billing parser improvements',
    '',
    '- `lineup-billing-parser.ts`: B2B/F2F/VS splitting, chained inline pairs, HTML line breaks, Live/Support/Hosted-by filtering.',
    '- `lineup-text-parser.ts`: per-line segmentation with comma fallback.',
    '- `lineup-artist-quality.ts`: collapsed names rejected during sanitization.',
    '- `import-lineup-from-record.ts`: expands structured lineup entries before publish.',
    '',
    '## 3. Artist integrity repair',
    '',
    `Controlled repair pass 1: ${pass1?.repaired ?? 0} events.`,
    `Controlled repair pass 2 (idempotency): ${pass2?.repaired ?? 0} events.`,
  ];

  const reps = integrity.representatives as Array<Record<string, unknown>> | undefined;
  if (reps?.length) {
    lines.push('', '## 4. Representative events', '');
    for (const rep of reps) {
      lines.push(
        `### ${rep.label}`,
        `- Found: ${rep.found}`,
        `- Canonical: ${JSON.stringify(rep.canonicalArtists ?? [])}`,
        `- Import: ${JSON.stringify(rep.importArtists ?? [])}`,
        '',
      );
    }
  }

  lines.push(
    '## 5. Before/after metrics',
    '',
    `Before: ${JSON.stringify(audit?.metrics ?? {})}`,
    `After: ${JSON.stringify(afterMetrics ?? {})}`,
    '',
    '## 6. Remaining blockers',
    '',
    'Events without structured import lineup evidence remain limited to title inference or flyer OCR (out of scope for 4.6.7).',
    'ALTCHA-blocked Ticket.io detail pages still prevent detail HTML lineup recovery.',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase467_artist_integrity.json`',
    '- `docs/real-data/_phase467_lineup_repairs.json`',
    '- `docs/real-data/_phase467_lineup_backup.json`',
    '- `docs/real-data/_phase467_metrics_before.json`',
    '- `docs/real-data/_phase467_metrics_after.json`',
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
      await runAudit();
    }
    if (phase === 'pass2' || phase === 'full') {
      await runRepairPass('pass2');
      const afterMetrics = await collectMetrics();
      writeFileSync(
        OUT_AFTER,
        JSON.stringify({ generatedAt: new Date().toISOString(), metrics: afterMetrics }, null, 2),
      );
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
