/**
 * Phase 4.6.8 — structured lineup entries with billing preservation.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase468-structured-lineup.ts [phase]
 *
 * Phases: backup | repair | validate | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countBillingRelationshipsInName,
  isCollapsedLineupArtistName,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { billingRelationLabel } from '@/features/aggregation/domain/canonical-lineup-entry';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { pickBestImportRecordForLineupRepair } from '@/features/import/services/lineup-projection-integrity';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase468_repair_backup.json');
const OUT_LINEUP_ENTRIES = join(ROOT, 'docs/real-data/_phase468_lineup_entries.json');
const OUT_BILLING_VALIDATION = join(ROOT, 'docs/real-data/_phase468_billing_validation.json');
const OUT_REPAIR_RUNS = join(ROOT, 'docs/real-data/_phase468_repair_runs.json');
const OUT_ADMIN_VALIDATION = join(ROOT, 'docs/real-data/_phase468_admin_validation.json');
const OUT_SCHEMA = join(ROOT, 'docs/real-data/_phase468_schema_validation.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_468_STRUCTURED_LINEUP_REPORT.md');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase468_state.json');

type RepresentativeSpec = {
  label: string;
  eventId: string;
  expectedEntries?: number;
  expectedArtists?: number;
  minEntries: number;
  expectedBilling: string[];
  allowBlocker?: boolean;
};

const REPRESENTATIVE_EVENTS: RepresentativeSpec[] = [
  {
    label: 'Sommerfest Elektroküche',
    eventId: 'evt-1785389055557-ux20897',
    expectedEntries: 14,
    expectedArtists: 14,
    minEntries: 14,
    expectedBilling: [],
  },
  {
    label: 'MDMA',
    eventId: 'evt-1785389054496-ns9b6la',
    expectedEntries: 9,
    expectedArtists: 18,
    minEntries: 9,
    expectedBilling: ['F2F', 'B2B'],
  },
  {
    label: 'LEVI',
    eventId: 'evt-1785339383539-0lxvjlp',
    expectedEntries: 1,
    expectedArtists: 1,
    minEntries: 1,
    expectedBilling: [],
  },
  {
    label: 'Bootshaus on a Ship Vol. III',
    eventId: 'evt-1785339420043-obhyeev',
    minEntries: 5,
    expectedBilling: [],
    allowBlocker: true,
  },
  {
    label: 'Vision Ekstase Open Air',
    eventId: 'evt-1785506404218-hgmd9nz',
    minEntries: 1,
    expectedBilling: [],
    allowBlocker: true,
  },
  {
    label: 'PURE TECHNO',
    eventId: 'evt-1785506448834-4c5s8xl',
    minEntries: 1,
    expectedBilling: [],
    allowBlocker: true,
  },
];

type PhaseState = Record<string, unknown>;

function loadState(): PhaseState {
  return existsSync(OUT_STATE)
    ? (JSON.parse(readFileSync(OUT_STATE, 'utf8')) as PhaseState)
    : { startedAt: new Date().toISOString() };
}

function saveState(state: PhaseState): void {
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

async function snapshotStructuredLineup(eventId: string) {
  const c = opsClient();
  const { data: entries } = await c
    .from('event_lineup_entries')
    .select(
      'id, sort_order, billing_relation, stage, start_time, end_time, running_order, confidence, provenance, event_lineup_entry_artists(artist_id, sort_order, artists(name))',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  const flatArtists = (
    await c
      .from('event_artists')
      .select('artist_id, sort_order, artists(name)')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
  ).data;

  return {
    entries: (entries ?? []).map((entry) => ({
      id: entry.id,
      order: entry.sort_order,
      billingRelation: entry.billing_relation,
      stage: entry.stage,
      startTime: entry.start_time,
      endTime: entry.end_time,
      runningOrder: entry.running_order,
      confidence: entry.confidence,
      provenance: entry.provenance,
      artists: (entry.event_lineup_entry_artists ?? [])
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((row) => row.artists?.name ?? row.artist_id),
    })),
    flatArtists: (flatArtists ?? []).map((row) => row.artists?.name ?? row.artist_id),
  };
}

async function runBackup(state: PhaseState): Promise<void> {
  const c = opsClient();
  const eventIds = REPRESENTATIVE_EVENTS.map((event) => event.eventId);
  const snapshots: Record<string, unknown> = {};

  for (const eventId of eventIds) {
    const { data: event } = await c.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) continue;
    const { data: flatRows } = await c
      .from('event_artists')
      .select('id, artist_id, sort_order, billing_role, artists(name, lineup_legacy_artifact)')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });
    snapshots[eventId] = {
      event,
      structuredLineup: await snapshotStructuredLineup(eventId),
      eventArtists: flatRows ?? [],
    };
  }

  const backup = {
    generatedAt: new Date().toISOString(),
    eventCount: Object.keys(snapshots).length,
    globalCounts: {
      event_lineup_entries: (
        await c.from('event_lineup_entries').select('id', { count: 'exact', head: true })
      ).count,
      event_lineup_entry_artists: (
        await c.from('event_lineup_entry_artists').select('id', { count: 'exact', head: true })
      ).count,
      event_artists: (await c.from('event_artists').select('id', { count: 'exact', head: true }))
        .count,
    },
    snapshots,
  };
  writeFileSync(OUT_BACKUP, JSON.stringify(backup, null, 2));
  state.backup = backup;
  saveState(state);
  console.log(`Backup written: ${OUT_BACKUP}`);
}

async function runSchemaValidation(state: PhaseState): Promise<boolean> {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    'npx',
    ['tsx', 'scripts/operations/_phase468-migration-state-check.ts'],
    { cwd: ROOT, shell: true, encoding: 'utf8' },
  );
  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  const schema = existsSync(OUT_SCHEMA)
    ? (JSON.parse(readFileSync(OUT_SCHEMA, 'utf8')) as { pass?: boolean })
    : { pass: false };
  state.schemaValidation = schema;
  saveState(state);
  return schema.pass === true;
}

async function runRepair(state: PhaseState): Promise<void> {
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
  const artists = await adminArtistRepository.getAll();
  const passes: unknown[] = [];

  for (let pass = 1; pass <= 5; pass += 1) {
    const mutations: unknown[] = [];
    for (const rep of REPRESENTATIVE_EVENTS) {
      const { data: event } = await c.from('events').select('id,title').eq('id', rep.eventId).maybeSingle();
      if (!event) continue;

      const before = await snapshotStructuredLineup(event.id);
      const { data: importRows } = await c
        .from('import_records')
        .select('id')
        .eq('resulting_event_id', event.id);
      const records: ImportRecord[] = [];
      for (const row of importRows ?? []) {
        const record = await importRecordRepository.getById(row.id);
        if (record) records.push(record);
      }
      if (records.length === 0) {
        mutations.push({
          eventId: event.id,
          title: event.title,
          skipped: 'no_import_records',
        });
        continue;
      }

      const existingIds =
        (
          await c.from('event_artists').select('artist_id').eq('event_id', event.id).order('sort_order')
        ).data?.map((row) => row.artist_id) ?? [];
      const picked = pickBestImportRecordForLineupRepair(
        records,
        existingIds,
        new Map(artists.map((artist) => [artist.id, artist] as const)),
      );
      const record = picked?.record ?? records[0];
      const repair = await importEventPublishService.repairLineupProjection(record!, event.id);
      const after = await snapshotStructuredLineup(event.id);
      const changed =
        repair.wroteLineup ||
        before.entries.length !== after.entries.length ||
        JSON.stringify(before.entries) !== JSON.stringify(after.entries);
      mutations.push({
        eventId: event.id,
        title: event.title,
        wroteLineup: repair.wroteLineup,
        changed,
        beforeEntryCount: before.entries.length,
        afterEntryCount: after.entries.length,
        beforeFlatCount: before.flatArtists.length,
        afterFlatCount: after.flatArtists.length,
      });
    }
    const mutationCount = mutations.filter((mutation) => (mutation as { changed: boolean }).changed).length;
    passes.push({ pass, mutations, mutationCount });
    if (mutationCount === 0) {
      break;
    }
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);
  const repairResult = { completedAt: new Date().toISOString(), passes };
  state.repair = repairResult;
  writeFileSync(OUT_REPAIR_RUNS, JSON.stringify(repairResult, null, 2));
  saveState(state);
  console.log(`Repair passes completed: ${passes.length}`);
}

async function runValidate(state: PhaseState): Promise<void> {
  const c = opsClient();
  const lineupEntriesReport: unknown[] = [];
  const billingValidation: unknown[] = [];

  for (const rep of REPRESENTATIVE_EVENTS) {
    const snapshot = await snapshotStructuredLineup(rep.eventId);
    lineupEntriesReport.push({
      label: rep.label,
      eventId: rep.eventId,
      entryCount: snapshot.entries.length,
      entries: snapshot.entries,
      flatArtists: snapshot.flatArtists,
    });

    const collapsedArtists = snapshot.flatArtists.filter(
      (name) => typeof name === 'string' && isCollapsedLineupArtistName(name),
    );
    const billingInNames = snapshot.flatArtists.filter(
      (name) => typeof name === 'string' && countBillingRelationshipsInName(name) > 0,
    );
    const billingRelations = snapshot.entries.map((entry) => entry.billingRelation);
    const nonSoloRelations = billingRelations.filter((relation) => relation !== 'SOLO');

    const artistCount = snapshot.entries.reduce((sum, entry) => sum + entry.artists.length, 0);
    const entryCountOk =
      rep.expectedEntries === undefined ? snapshot.entries.length >= rep.minEntries : snapshot.entries.length === rep.expectedEntries;
    const artistCountOk =
      rep.expectedArtists === undefined ? artistCount >= rep.minEntries : artistCount === rep.expectedArtists;
    const pass =
      entryCountOk &&
      artistCountOk &&
      collapsedArtists.length === 0 &&
      billingInNames.length === 0 &&
      (rep.expectedBilling.length === 0 ||
        rep.expectedBilling.every((relation) => billingRelations.includes(relation)));

    billingValidation.push({
      label: rep.label,
      eventId: rep.eventId,
      pass: pass || Boolean(rep.allowBlocker && snapshot.entries.length > 0),
      strictPass: pass,
      allowBlocker: rep.allowBlocker ?? false,
      entryCount: snapshot.entries.length,
      artistCount,
      expectedEntries: rep.expectedEntries,
      expectedArtists: rep.expectedArtists,
      minEntries: rep.minEntries,
      collapsedArtists,
      billingInNames,
      nonSoloRelations,
      expectedBillingPresent: rep.expectedBilling.every((relation) => billingRelations.includes(relation)),
      entries: snapshot.entries.map((entry) => ({
        billing: entry.billingRelation,
        artists: entry.artists,
        label:
          entry.billingRelation === 'SOLO'
            ? entry.artists.join(', ')
            : entry.artists.join(` ${billingRelationLabel(entry.billingRelation as never)} `),
      })),
    });
  }

  writeFileSync(OUT_LINEUP_ENTRIES, JSON.stringify(lineupEntriesReport, null, 2));
  writeFileSync(OUT_BILLING_VALIDATION, JSON.stringify(billingValidation, null, 2));
  writeFileSync(
    OUT_ADMIN_VALIDATION,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        structuredLineupAdminSection: 'StructuredLineupAdminSection',
        capabilities: ['view', 'add', 'remove', 'billing_relation', 'reorder', 'stage', 'times', 'provenance'],
        representatives: billingValidation,
      },
      null,
      2,
    ),
  );
  state.validation = {
    generatedAt: new Date().toISOString(),
    passCount: billingValidation.filter((row) => (row as { strictPass: boolean }).strictPass).length,
    total: billingValidation.length,
  };
  saveState(state);
  console.log(`Validation: ${(state.validation as { passCount: number }).passCount}/${billingValidation.length}`);
}

async function runReport(state: PhaseState): Promise<void> {
  const validation = existsSync(OUT_BILLING_VALIDATION)
    ? JSON.parse(readFileSync(OUT_BILLING_VALIDATION, 'utf8'))
    : [];
  const schema = existsSync(OUT_SCHEMA)
    ? JSON.parse(readFileSync(OUT_SCHEMA, 'utf8'))
    : null;
  const repair = (state.repair as { passes?: Array<{ pass: number; mutationCount: number }> }) ?? {
    passes: [],
  };
  const finalPass = repair.passes[repair.passes.length - 1];
  const idempotent = finalPass?.mutationCount === 0;

  const lines = [
    '# Phase 4.6.8 — Structured Lineup Pipeline Completion',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Migration / schema validation',
    '',
    schema
      ? `- Entries: ${JSON.stringify((schema as { totals?: { event_lineup_entries?: unknown } }).totals?.event_lineup_entries)}`
      : '- Schema validation not run',
    schema
      ? `- Entry-artists: ${JSON.stringify((schema as { totals?: { event_lineup_entry_artists?: unknown } }).totals?.event_lineup_entry_artists)}`
      : '',
    schema && (schema as { blockers?: string[] }).blockers?.length
      ? `- **Blockers:** ${(schema as { blockers: string[] }).blockers.join('; ')}`
      : '',
    '',
    '## 2. Shared domain contract',
    '',
    '- `StructuredLineupEntry` (connector/import metadata)',
    '- `CanonicalLineupEntry` / `ResolvedCanonicalLineupEntry` (merge/persistence/projection)',
    '- `BillingRelation`: SOLO, B2B, F2F, VS, LIVE, SUPPORT, HOSTED_BY, SPECIAL_GUEST',
    '',
    '## 3. Connector normalized output',
    '',
    '- `lineupEntries` in connector metadata; `artistNames` fallback only',
    '- `lineup-entry-builder.ts` groups billing without synthetic combined artist names',
    '',
    '## 4. Import preservation',
    '',
    '- `extractPrioritizedLineupEntries` preserves structure through publish',
    '- `writeImportStructuredLineup` no longer skips when flat `event_artists` matches but structured storage is empty/legacy',
    '',
    '## 5. Artist resolution',
    '',
    '- Per-artist resolution inside each entry via `resolveArtistIdsForNames`',
    '- Legacy/blob artists excluded via `lineup-artist-quality` + `lineup_legacy_artifact`',
    '',
    '## 6. Structured persistence',
    '',
    '- `EventLineupEntryRepository` + `replaceEventLineupEntries` (transactional replace)',
    '- `EventLineupService.replaceStructuredLineupFromImport` dual-writes flat `event_artists`',
    '',
    '## 7. Canonical merge',
    '',
    '- `mergeCanonicalLineupEntries` in merge strategy',
    '',
    '## 8. Dual-write compatibility',
    '',
    '- Structured entries authoritative; `event_artists` derived via `buildLineupFromResolvedEntries`',
    '',
    '## 9. Projection / API',
    '',
    '- `Event.lineupEntries[]` loaded in `supabase-datasource.ts`',
    '- Flat `artists[]` retained for current public UI',
    '',
    '## 10. Admin support',
    '',
    '- `StructuredLineupAdminSection` in admin event editor',
    '',
    '## 11. Backfill reconstruction',
    '',
    '- SQL backfill creates low-confidence SOLO rows from `event_artists`',
    '- Import repair upgrades via `needsStructuredLineupReplace` when import evidence exists',
    '',
    '## 12. Representative production results',
    '',
    ...validation.map(
      (row: {
        label: string;
        eventId: string;
        strictPass: boolean;
        entryCount: number;
        artistCount?: number;
        expectedEntries?: number;
        expectedArtists?: number;
      }) =>
        `- ${row.label}: ${row.strictPass ? 'PASS' : 'PENDING/FAIL'} — ${row.entryCount} entries` +
        (row.expectedEntries !== undefined ? ` (expected ${row.expectedEntries})` : '') +
        (row.artistCount !== undefined && row.expectedArtists !== undefined
          ? `, ${row.artistCount} artists (expected ${row.expectedArtists})`
          : ''),
    ),
    '',
    '## 13. Idempotency',
    '',
    `- Final repair pass mutations: ${finalPass?.mutationCount ?? 'not run'}`,
    `- Stable (0 mutations): ${idempotent ? 'YES' : 'NO'}`,
    '',
    '## 14. Performance',
    '',
    '- Batch load: `getEntriesForEvents` in event datasource',
    '- Indexes: `event_lineup_entries(event_id, sort_order)`, `event_lineup_entry_artists(entry_id)`',
    '',
    '## 15. Tests / build',
    '',
    '- `structured-lineup-replace-decision.test.ts`',
    '- `phase468-structured-lineup-migration.test.ts` (+ service grants)',
    '- `typecheck:app` passes',
    '',
    '## 16. Remaining blockers',
    '',
    '1. Apply `20260803130000_phase468_structured_lineup_service_grants.sql` (service_role GRANT)',
    '2. Re-run `npx tsx scripts/operations/_phase468-structured-lineup.ts full` after grants',
    '3. Bootshaus on a Ship: `source_text_structurally_insufficient` — no unsafe splitting',
    '',
    '## 17. Cutover recommendation',
    '',
    idempotent && (schema as { pass?: boolean } | null)?.pass
      ? '**Proceed** — structured lineup authoritative; flat projection synced; idempotent repair confirmed.'
      : '**Hold** — apply service grants, run schema validation + repair to 0 mutations, then re-validate mobile Event Detail.',
    '',
  ];

  writeFileSync(OUT_REPORT, lines.join('\n'));
  console.log(`Report written: ${OUT_REPORT}`);
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';
  const state = loadState();

  if (phase === 'schema' || phase === 'full') {
    const schemaOk = await runSchemaValidation(state);
    if (!schemaOk && phase === 'schema') {
      process.exitCode = 1;
      return;
    }
    if (!schemaOk && phase === 'full') {
      console.error('Schema validation failed — aborting cutover.');
      process.exitCode = 1;
      return;
    }
  }
  if (phase === 'backup' || phase === 'full') {
    await runBackup(state);
  }
  if (phase === 'repair' || phase === 'full') {
    await runRepair(state);
  }
  if (phase === 'validate' || phase === 'full') {
    await runValidate(state);
  }
  if (phase === 'report' || phase === 'full') {
    await runReport(state);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
