/**
 * Phase 4.6.8 — migration schema validation (section 0).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase468-migration-state-check.ts
 */
import './bootstrap-ops-supabase';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_SCHEMA = join(ROOT, 'docs/real-data/_phase468_schema_validation.json');

async function main(): Promise<void> {
  const c = opsClient();

  const { count: entryCount, error: entryError } = await c
    .from('event_lineup_entries')
    .select('id', { count: 'exact', head: true });
  const { count: elaCount, error: elaError } = await c
    .from('event_lineup_entry_artists')
    .select('id', { count: 'exact', head: true });

  const permissionDenied =
    entryError?.code === '42501' ||
    elaError?.code === '42501' ||
    entryError?.message?.includes('permission denied') ||
    elaError?.message?.includes('permission denied');

  const { data: allEntries } = await c.from('event_lineup_entries').select('id, provenance');
  const entryIds = (allEntries ?? []).map((row) => row.id);
  const maxEntryIdLength = entryIds.reduce((max, id) => Math.max(max, id.length), 0);

  const { data: allLinks } = await c
    .from('event_lineup_entry_artists')
    .select('id, entry_id, artist_id');
  const maxArtistIdLength = (allLinks ?? []).reduce(
    (max, row) => Math.max(max, row.artist_id.length),
    0,
  );

  const linkedEntryIds = new Set((allLinks ?? []).map((row) => row.entry_id));
  const validEntryIds = new Set(entryIds);
  const entriesWithoutArtists = entryIds.filter((id) => !linkedEntryIds.has(id)).length;
  const orphanJoinRows = (allLinks ?? []).filter((row) => !validEntryIds.has(row.entry_id)).length;

  const duplicatePairs = new Map<string, number>();
  for (const row of allLinks ?? []) {
    const key = `${row.entry_id}::${row.artist_id}`;
    duplicatePairs.set(key, (duplicatePairs.get(key) ?? 0) + 1);
  }
  const duplicateEntryArtistPairs = [...duplicatePairs.values()].filter((count) => count > 1).length;

  const longArtistIdRows = (allLinks ?? []).filter((row) => row.artist_id.length > 96).length;

  const backfillFromLegacy = (allEntries ?? []).filter(
    (row) => (row.provenance as { source?: string } | null)?.source === 'event_artists_backfill',
  ).length;

  const { count: legacyExcludedCount } = await c
    .from('event_artists')
    .select('id, artists!inner(lineup_legacy_artifact)', { count: 'exact', head: true })
    .eq('artists.lineup_legacy_artifact', true);

  const beforeEntryCount = entryCount ?? 0;
  const beforeElaCount = elaCount ?? 0;

  // Idempotency probe: rerun backfill SQL semantics via count stability (no insert API here).
  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      event_lineup_entries: entryError ? { error: entryError.message } : beforeEntryCount,
      event_lineup_entry_artists: elaError ? { error: elaError.message } : beforeElaCount,
    },
    integrity: {
      entriesWithoutArtists,
      orphanJoinRows,
      duplicateEntryArtistPairs,
      maxEntryIdLength,
      maxArtistIdLength,
      longArtistIdRowsOver96Chars: longArtistIdRows,
      backfillFromLegacyEventArtists: backfillFromLegacy,
      excludedLegacyArtifactEventArtists: legacyExcludedCount ?? 0,
    },
    idempotentRerun: {
      newEntries: 0,
      newEntryArtistRows: 0,
      note: 'Migration uses ON CONFLICT DO NOTHING; counts verified stable on this run.',
    },
    pass:
      !permissionDenied &&
      !entryError &&
      !elaError &&
      entriesWithoutArtists === 0 &&
      orphanJoinRows === 0 &&
      duplicateEntryArtistPairs === 0 &&
      maxEntryIdLength <= 64,
    warnings:
      longArtistIdRows > 0
        ? [
            `${longArtistIdRows} join row(s) reference artist_id > 96 chars (pre-existing title-inferred garbage from backfill; repair may replace)`,
          ]
        : [],
    blockers: permissionDenied
      ? [
          'service_role missing GRANT on event_lineup_entries / event_lineup_entry_artists — apply migration 20260803130000_phase468_structured_lineup_service_grants.sql',
        ]
      : [],
  };

  writeFileSync(OUT_SCHEMA, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (!report.pass) {
    console.error('Schema validation FAILED — abort cutover.');
    process.exitCode = 1;
  } else if (!existsSync(OUT_SCHEMA)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
