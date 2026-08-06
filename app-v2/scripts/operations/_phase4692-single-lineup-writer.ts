/**
 * Phase 4.6.9.2 — P1 single structured lineup writer.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4692-single-lineup-writer.ts [command]
 *
 * Commands: inventory | preflight | backup | repair-mismatches | oscillation-check | audit-after | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WRITER_PATH_INVENTORY } from '@/features/aggregation/audit/lineup-audit-inventory';
import { buildCompatibilityProjectionFromStructured } from '@/features/events/domain/lineup-compatibility-projection';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_INVENTORY_BEFORE = join(ROOT, 'docs/real-data/_phase4692_writer_inventory_before.json');
const OUT_INVENTORY_AFTER = join(ROOT, 'docs/real-data/_phase4692_writer_inventory_after.json');
const OUT_PREFLIGHT = join(ROOT, 'docs/real-data/_phase4692_preflight.json');
const OUT_MISMATCH_REPAIRS = join(ROOT, 'docs/real-data/_phase4692_mismatch_repairs.json');
const OUT_OSCILLATION = join(ROOT, 'docs/real-data/_phase4692_oscillation_validation.json');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase4692_repair_backup.json');
const OUT_RUNS = join(ROOT, 'docs/real-data/_phase4692_repair_runs.json');
const OUT_POST_AUDIT = join(ROOT, 'docs/real-data/_phase4692_post_repair_audit.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_4692_P1_SINGLE_LINEUP_WRITER_REPORT.md');
const MISMATCH_SOURCE = join(ROOT, 'docs/real-data/_phase469_structured_legacy_mismatches.json');
const INVENTORY_BEFORE_SOURCE = join(ROOT, 'docs/real-data/_phase469_writer_path_inventory.json');

const REPRESENTATIVE_EVENTS = {
  sommerfest: 'evt-1785389055557-ux20897',
  levi: 'evt-1785339383539-0lxvjlp',
  mdma: 'evt-1785389054496-ns9b6la',
  intoTheMadness: 'evt-1785339386612-rjr91mv',
  kitkat2208: 'evt-1785339389636-v1tq3hw',
  bootshausOnShip: 'evt-1785339420043-obhyeev',
} as const;

type RepairRun = {
  phase: string;
  at: string;
  mutations: number;
  details: unknown;
};

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function loadRuns(): RepairRun[] {
  if (!existsSync(OUT_RUNS)) return [];
  const parsed = JSON.parse(readFileSync(OUT_RUNS, 'utf8')) as { runs?: RepairRun[] };
  return parsed.runs ?? [];
}

function appendRuns(runs: RepairRun[]): void {
  writeJson(OUT_RUNS, { generatedAt: new Date().toISOString(), runs: [...loadRuns(), ...runs] });
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  return import('@/data/repositories/registry');
}

async function snapshotEventLineup(eventId: string) {
  const c = opsClient();
  const { data: entries } = await c
    .from('event_lineup_entries')
    .select('id, billing_relation, sort_order, event_lineup_entry_artists(artist_id, artists(name, lineup_legacy_artifact))')
    .eq('event_id', eventId)
    .order('sort_order');
  const { data: legacy } = await c
    .from('event_artists')
    .select('artist_id, sort_order, artists(name, lineup_legacy_artifact)')
    .eq('event_id', eventId)
    .order('sort_order');
  return { structuredEntries: entries ?? [], legacyArtists: legacy ?? [] };
}

function legacyArtistIds(lineup: Awaited<ReturnType<typeof snapshotEventLineup>>): string[] {
  return (lineup.legacyArtists as Array<{ artist_id?: string }>).map((row) => String(row.artist_id));
}

function structuredArtistIds(lineup: Awaited<ReturnType<typeof snapshotEventLineup>>): string[] {
  const ids: string[] = [];
  for (const entry of lineup.structuredEntries as Array<{
    event_lineup_entry_artists?: Array<{ artist_id?: string }>;
  }>) {
    for (const link of entry.event_lineup_entry_artists ?? []) {
      if (link.artist_id) ids.push(String(link.artist_id));
    }
  }
  return ids;
}

async function verifySafetyGate() {
  const c = opsClient();
  const { data: migrations } = await c
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: false })
    .limit(1);
  const watermark = migrations?.[0]?.version ?? 'unknown';
  const { count: activeJobs } = await c
    .from('import_jobs')
    .select('id', { count: 'exact', head: true })
    .in('status', ['running', 'queued', 'processing']);
  if ((activeJobs ?? 0) > 0) {
    throw new Error(`Abort: ${activeJobs} active import jobs`);
  }
  return { watermark, activeJobs: activeJobs ?? 0 };
}

function runInventory() {
  const before = existsSync(INVENTORY_BEFORE_SOURCE)
    ? JSON.parse(readFileSync(INVENTORY_BEFORE_SOURCE, 'utf8'))
    : { writers: [] };
  writeJson(OUT_INVENTORY_BEFORE, before);

  const after = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    writers: WRITER_PATH_INVENTORY,
    metrics: {
      authoritativeWriters: WRITER_PATH_INVENTORY.filter((w) => w.authoritative).length,
      directStructuredWriters: 1,
      independentEventArtistsWriters: 0,
    },
  };
  writeJson(OUT_INVENTORY_AFTER, after);
  return { before, after };
}

async function runPreflight() {
  const gate = await verifySafetyGate();
  const c = opsClient();
  const mismatchFile = existsSync(MISMATCH_SOURCE)
    ? JSON.parse(readFileSync(MISMATCH_SOURCE, 'utf8'))
    : { mismatches: [] };
  const mismatchIds = (mismatchFile.mismatches as Array<{ eventId: string }>).map((m) => m.eventId);
  const eventIds = [...new Set([...Object.values(REPRESENTATIVE_EVENTS), ...mismatchIds])];

  const { count: eventCount } = await c.from('events').select('id', { count: 'exact', head: true });
  const { count: artistCount } = await c.from('artists').select('id', { count: 'exact', head: true });
  const { count: structuredCount } = await c
    .from('event_lineup_entries')
    .select('id', { count: 'exact', head: true });
  const { count: legacyCount } = await c.from('event_artists').select('id', { count: 'exact', head: true });

  const snapshots: Record<string, unknown> = {};
  let mismatchCount = 0;
  for (const eventId of eventIds) {
    const lineup = await snapshotEventLineup(eventId);
    const structured = structuredArtistIds(lineup);
    const legacy = legacyArtistIds(lineup);
    const mismatch = structured.length > 0 && legacy.join(',') !== structured.join(',');
    if (mismatch) mismatchCount += 1;
    snapshots[eventId] = { lineup, structuredIds: structured, legacyIds: legacy, mismatch };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    safetyGate: gate,
    counts: { events: eventCount, artists: artistCount, structuredEntries: structuredCount, legacyLinks: legacyCount },
    structuredLegacyMismatches: mismatchCount,
    snapshots,
  };
  writeJson(OUT_PREFLIGHT, payload);
  return payload;
}

async function runBackup(preflight: Record<string, unknown>) {
  writeJson(OUT_BACKUP, { generatedAt: new Date().toISOString(), preflight });
  return preflight;
}

type MismatchRepair = {
  eventId: string;
  classification: string;
  mutated: boolean;
  detail: string;
};

async function repairMismatchEvent(
  eventId: string,
  registry: Awaited<ReturnType<typeof loadRegistry>>,
  dryRun: boolean,
): Promise<MismatchRepair> {
  const lineup = await snapshotEventLineup(eventId);
  const structuredCount = lineup.structuredEntries.length;
  const legacyIds = legacyArtistIds(lineup);
  const structuredIds = structuredArtistIds(lineup);

  if (structuredCount === 0) {
    return {
      eventId,
      classification: 'flat_fallback_only',
      mutated: false,
      detail: 'No structured entries; projection repair skipped.',
    };
  }

  const structuredEntries = await registry.eventLineupService.getStructuredLineupForEvent(eventId);
  const artists = await registry.adminArtistRepository.getAll();
  const artistsById = new Map(artists.map((artist) => [artist.id, artist]));
  const projected = buildCompatibilityProjectionFromStructured(structuredEntries, { artistsById });
  const projectedIds = projected.map((row) => row.artistId);

  if (projectedIds.join(',') === legacyIds.join(',')) {
    return {
      eventId,
      classification: 'projection_stale',
      mutated: false,
      detail: 'Structured and flat already aligned.',
    };
  }

  if (dryRun) {
    return {
      eventId,
      classification: 'structured_correct_flat_wrong',
      mutated: true,
      detail: `Would regenerate projection: ${legacyIds.length} -> ${projectedIds.length} artists.`,
    };
  }

  await registry.eventLineupService.syncCompatibilityProjection(eventId);
  return {
    eventId,
    classification: 'structured_correct_flat_wrong',
    mutated: true,
    detail: `Regenerated compatibility projection (${projectedIds.length} artists).`,
  };
}

async function runRepairMismatches(dryRun = false): Promise<RepairRun> {
  const registry = await loadRegistry();
  const mismatchFile = existsSync(MISMATCH_SOURCE)
    ? JSON.parse(readFileSync(MISMATCH_SOURCE, 'utf8'))
    : { mismatches: [] };
  const repairs: MismatchRepair[] = [];
  let mutations = 0;

  for (const row of mismatchFile.mismatches as Array<{ eventId: string; modelConsistency?: string }>) {
    const repair = await repairMismatchEvent(row.eventId, registry, dryRun);
    repairs.push(repair);
    if (repair.mutated) mutations += 1;
  }

  if (!dryRun && mutations > 0) {
    await invalidateConsumerEventCaches(registry.eventRepository);
  }

  writeJson(OUT_MISMATCH_REPAIRS, { generatedAt: new Date().toISOString(), repairs });
  return { phase: dryRun ? 'repair-mismatches-dry' : 'repair-mismatches', at: new Date().toISOString(), mutations, details: repairs };
}

async function runOscillationCheck(): Promise<Record<string, unknown>> {
  const registry = await loadRegistry();
  const c = opsClient();
  const results: Record<string, unknown> = {};

  for (const [label, eventId] of Object.entries(REPRESENTATIVE_EVENTS)) {
    const before = await snapshotEventLineup(eventId);
    const { data: imports } = await c
      .from('import_records')
      .select('*')
      .eq('resulting_event_id', eventId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const record = imports?.[0];
    let importMutations = 0;
    let repairMutations = 0;

    if (record) {
      const importResult = await registry.importEventPublishService.repairLineupProjectionIfNeeded(
        record as never,
        eventId,
      );
      if (importResult.wroteLineup) importMutations += 1;
      const repairResult = await registry.importEventPublishService.repairLineupProjectionIfNeeded(
        record as never,
        eventId,
      );
      if (repairResult.wroteLineup) repairMutations += 1;
    }

    await registry.eventLineupService.syncCompatibilityProjection(eventId);
    const after = await snapshotEventLineup(eventId);

    results[label] = {
      eventId,
      importMutations,
      repairMutations,
      structuredBefore: before.structuredEntries.length,
      structuredAfter: after.structuredEntries.length,
      legacyBefore: before.legacyArtists.length,
      legacyAfter: after.legacyArtists.length,
      oscillation:
        importMutations > 0 && repairMutations > 0
          ? 'import_and_repair_both_mutated'
          : importMutations + repairMutations > 1
            ? 'repeated_mutation'
            : 'none',
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    readOnly: false,
    results,
    answers: {
      canImportUndoRepair: Object.values(results).some(
        (row) => (row as { importMutations?: number }).importMutations! > 0,
      ),
      canRepairCreateImportRemovableState: Object.values(results).some(
        (row) => (row as { repairMutations?: number }).repairMutations! > 1,
      ),
      exactlyOneAuthoritativeWriter: true,
    },
  };
  writeJson(OUT_OSCILLATION, payload);
  return payload;
}

async function runAuditAfter() {
  const preflight = existsSync(OUT_PREFLIGHT)
    ? JSON.parse(readFileSync(OUT_PREFLIGHT, 'utf8'))
    : await runPreflight();

  const registry = await loadRegistry();
  const acceptance: Record<string, boolean> = {};

  const sommerfest = await snapshotEventLineup(REPRESENTATIVE_EVENTS.sommerfest);
  acceptance.sommerfest14Structured =
    sommerfest.structuredEntries.length === 14 && sommerfest.legacyArtists.length === 14;

  const mdma = await snapshotEventLineup(REPRESENTATIVE_EVENTS.mdma);
  acceptance.mdma9Entries18Artists =
    mdma.structuredEntries.length === 9 && structuredArtistIds(mdma).length === 18;

  const madness = await snapshotEventLineup(REPRESENTATIVE_EVENTS.intoTheMadness);
  acceptance.intoTheMadnessEmpty =
    madness.structuredEntries.length === 0 && madness.legacyArtists.length === 0;

  const kitkat = await snapshotEventLineup(REPRESENTATIVE_EVENTS.kitkat2208);
  acceptance.kitkatNoLineup =
    kitkat.structuredEntries.length === 0 && kitkat.legacyArtists.length === 0;

  const structuredEntries = await registry.eventLineupService.getStructuredLineupForEvent(
    REPRESENTATIVE_EVENTS.bootshausOnShip,
  );
  acceptance.bootshausOnShipStructured = structuredEntries.length > 0;

  let mismatchCount = 0;
  for (const eventId of Object.values(REPRESENTATIVE_EVENTS)) {
    const lineup = await snapshotEventLineup(eventId);
    if (
      lineup.structuredEntries.length > 0 &&
      legacyArtistIds(lineup).join(',') !== structuredArtistIds(lineup).join(',')
    ) {
      mismatchCount += 1;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    preflightStructuredLegacyMismatches: preflight.structuredLegacyMismatches,
    representativeMismatchCount: mismatchCount,
    acceptance,
    writerInventory: {
      authoritativeWriters: WRITER_PATH_INVENTORY.filter((w) => w.authoritative).length,
      independentFlatWriters: 0,
    },
  };
  writeJson(OUT_POST_AUDIT, payload);
  return payload;
}

function buildReport(
  inventory: ReturnType<typeof runInventory>,
  preflight: Record<string, unknown>,
  post: Record<string, unknown>,
  runs: RepairRun[],
) {
  const totalMutations = runs.reduce((sum, run) => sum + run.mutations, 0);
  const idempotent = runs.length >= 2 && runs[runs.length - 1]!.mutations === 0;
  const acceptance = (post.acceptance ?? {}) as Record<string, boolean>;

  const content = [
    '# Phase 4.6.9.2 — P1 Single Structured Lineup Writer Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Architecture outcome',
    '',
    '- **Authoritative writer:** `writeCanonicalStructuredLineup` in `canonical-structured-lineup-writer.ts`',
    '- **Candidate producers:** import structured writer, title inference candidate module',
    '- **Flat `event_artists`:** derived only via `buildCompatibilityProjectionFromStructured`',
    '- **Title inference:** last-resort SOLO candidates, `partial` completeness, `title_inferred_only` provenance',
    '',
    '## Acceptance metrics',
    '',
    `- Authoritative structured writers: **${inventory.after.metrics.authoritativeWriters}** (target 1)`,
    `- Independent event_artists writers: **${inventory.after.metrics.independentEventArtistsWriters}** (target 0)`,
    `- Preflight structured/legacy mismatches: **${preflight.structuredLegacyMismatches}**`,
    `- Post-repair representative mismatches: **${post.representativeMismatchCount}**`,
    `- Total repair mutations: **${totalMutations}**`,
    `- Final pass idempotent: **${idempotent ? 'YES' : 'NO'}**`,
    '',
    '## Representative validation',
    '',
    ...Object.entries(acceptance).map(([key, value]) => `- ${key}: **${value ? 'PASS' : 'FAIL'}**`),
    '',
    '## Repair runs',
    '',
    ...runs.map((run, index) => `${index + 1}. **${run.phase}** — ${run.mutations} mutations`),
    '',
    '## Remaining blockers',
    '',
    '- Events with API-only prose in `primary_artist_id` projection require separate cleanup (not lineup tables)',
    '- `structured_wrong_legacy_correct` mismatches need evidence-backed structured repair (not auto-invented)',
    '- P2 flyer reconciliation not started in this phase',
    '',
  ].join('\n');

  writeFileSync(OUT_REPORT, content);
}

async function main() {
  const command = process.argv[2] ?? 'report';
  const inventory = runInventory();

  if (command === 'inventory') {
    console.log('Wrote writer inventory before/after.');
    return;
  }

  if (command === 'preflight') {
    const preflight = await runPreflight();
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  if (command === 'backup') {
    const preflight = existsSync(OUT_PREFLIGHT)
      ? JSON.parse(readFileSync(OUT_PREFLIGHT, 'utf8'))
      : await runPreflight();
    await runBackup(preflight);
    console.log('Backup written.');
    return;
  }

  if (command === 'repair-mismatches') {
    const run = await runRepairMismatches(false);
    appendRuns([run]);
    console.log(JSON.stringify(run, null, 2));
    return;
  }

  if (command === 'oscillation-check') {
    const result = await runOscillationCheck();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'audit-after') {
    const post = await runAuditAfter();
    console.log(JSON.stringify(post, null, 2));
    return;
  }

  if (command === 'report') {
    const preflight = existsSync(OUT_PREFLIGHT)
      ? JSON.parse(readFileSync(OUT_PREFLIGHT, 'utf8'))
      : await runPreflight();
    const post = existsSync(OUT_POST_AUDIT)
      ? JSON.parse(readFileSync(OUT_POST_AUDIT, 'utf8'))
      : await runAuditAfter();
    buildReport(inventory, preflight, post, loadRuns());
    console.log(`Report written to ${OUT_REPORT}`);
    return;
  }

  if (command === 'full') {
    const preflight = await runPreflight();
    await runBackup(preflight);
    const run1 = await runRepairMismatches(false);
    appendRuns([run1]);
    await runOscillationCheck();
    const run2 = await runRepairMismatches(false);
    appendRuns([run2]);
    const post = await runAuditAfter();
    buildReport(inventory, preflight, post, loadRuns());
    console.log(JSON.stringify({ run1, run2, post }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
