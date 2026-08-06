/**
 * Phase 4.6.9.1 — P0 lineup integrity (ownership isolation + artist quality gate).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4691-p0-lineup-integrity.ts [command]
 *
 * Commands: preflight | backup | repair-ownership | repair-invalid-artists | repair | audit-after | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateArtistCandidate } from '@/features/events/domain/artist-candidate-quality-gate';
import { importRecordMayContributeLineup } from '@/features/import/matching/event-ownership-decision';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { markInvalidLineupArtifacts } from '@/features/import/services/p0-invalid-artist-cleanup';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_PREFLIGHT = join(ROOT, 'docs/real-data/_phase4691_preflight.json');
const OUT_OWNERSHIP = join(ROOT, 'docs/real-data/_phase4691_event_ownership_decisions.json');
const OUT_INVALID = join(ROOT, 'docs/real-data/_phase4691_invalid_artist_cleanup.json');
const OUT_BEFORE_AFTER = join(ROOT, 'docs/real-data/_phase4691_before_after.json');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase4691_repair_backup.json');
const OUT_RUNS = join(ROOT, 'docs/real-data/_phase4691_repair_runs.json');
const OUT_POST_AUDIT = join(ROOT, 'docs/real-data/_phase4691_post_repair_audit.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_4691_P0_LINEUP_INTEGRITY_REPORT.md');

const P0_EVENTS = {
  intoTheMadness: 'evt-1785339386612-rjr91mv',
  mdma: 'evt-1785389054496-ns9b6la',
  kitkat2208: 'evt-1785339389636-v1tq3hw',
  kitkat2410: 'evt-1785339372839-cwbr6ya',
} as const;

const MDMA_SOURCE_URL_PATTERN = /mdma-musik-die-mich-antreibt/i;

type RepairRun = {
  phase: string;
  at: string;
  mutations: number;
  details: unknown;
};

function loadRuns(): RepairRun[] {
  if (!existsSync(OUT_RUNS)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(OUT_RUNS, 'utf8')) as { runs?: RepairRun[] };
  return parsed.runs ?? [];
}

function appendRuns(runs: RepairRun[]): void {
  const existing = loadRuns();
  writeJson(OUT_RUNS, {
    generatedAt: new Date().toISOString(),
    runs: [...existing, ...runs],
  });
}

function lineupIsEmpty(lineup: Awaited<ReturnType<typeof snapshotEventLineup>>): boolean {
  return lineup.structuredEntries.length === 0 && lineup.legacyArtists.length === 0;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  return {
    importRecordRepository: registry.importRecordRepository,
    importEventPublishService: registry.importEventPublishService,
    adminArtistRepository: registry.adminArtistRepository,
    eventRepository: registry.eventRepository,
    sourceReferences: registry.multiSourceRepositories.sourceReferences,
    eventLineupService: registry.eventLineupService,
  };
}

async function snapshotEventLineup(eventId: string) {
  const c = opsClient();
  const { data: entries } = await c
    .from('event_lineup_entries')
    .select('id, billing_relation, event_lineup_entry_artists(artist_id, artists(name))')
    .eq('event_id', eventId);
  const { data: legacy } = await c
    .from('event_artists')
    .select('artist_id, artists(name)')
    .eq('event_id', eventId);
  return { structuredEntries: entries ?? [], legacyArtists: legacy ?? [] };
}

async function collectInvalidArtistRows(eventIds: string[]) {
  const c = opsClient();
  const rows: unknown[] = [];
  for (const eventId of eventIds) {
    const lineup = await snapshotEventLineup(eventId);
    const names = new Set<string>();
    for (const entry of lineup.structuredEntries as Array<{
      event_lineup_entry_artists?: Array<{ artists?: { name?: string } | null }>;
    }>) {
      for (const link of entry.event_lineup_entry_artists ?? []) {
        if (link.artists?.name) names.add(link.artists.name);
      }
    }
    for (const link of lineup.legacyArtists as Array<{ artists?: { name?: string } | null }>) {
      if (link.artists?.name) names.add(link.artists.name);
    }
    for (const name of names) {
      const gate = evaluateArtistCandidate({ name, sourceField: 'lineup' });
      if (gate.decision === 'invalid') {
        rows.push({ eventId, name, signals: gate.signals, decision: gate.decision });
      }
    }
  }
  return rows;
}

async function runPreflight() {
  const c = opsClient();
  const eventIds = Object.values(P0_EVENTS);
  const before: Record<string, unknown> = {};
  for (const eventId of eventIds) {
    const { data: event } = await c.from('events').select('id,title,description,ticket_url,website_url').eq('id', eventId).maybeSingle();
    const { data: refs } = await c.from('event_source_references').select('*').eq('canonical_event_id', eventId);
    const lineup = await snapshotEventLineup(eventId);
    before[eventId] = { event, refs, lineup };
  }
  const invalid = await collectInvalidArtistRows(eventIds);
  const payload = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    commit: process.env.GIT_COMMIT ?? 'unknown',
    eventIds,
    before,
    invalidArtistCount: invalid.length,
    invalidArtists: invalid,
  };
  writeJson(OUT_PREFLIGHT, payload);
  return payload;
}

async function runBackup(state: Record<string, unknown>) {
  writeJson(OUT_BACKUP, { generatedAt: new Date().toISOString(), ...state });
}

async function repairOwnership(dryRun: boolean): Promise<RepairRun> {
  const registry = await loadRegistry();
  const c = opsClient();
  let mutations = 0;
  const details: unknown[] = [];

  const madnessId = P0_EVENTS.intoTheMadness;
  const { data: refs } = await c
    .from('event_source_references')
    .select('*')
    .eq('canonical_event_id', madnessId);
  for (const ref of refs ?? []) {
    const url = String(ref.original_url ?? ref.external_event_id ?? '');
    if (!MDMA_SOURCE_URL_PATTERN.test(url)) continue;
    if (ref.active === false) {
      details.push({ action: 'skip_detach_already_inactive', refId: ref.id });
      continue;
    }
    if (!dryRun) {
      await registry.sourceReferences.markInactive(String(ref.source_id), String(ref.external_event_id));
      mutations += 1;
    }
    details.push({ action: 'detach_mdma_origin', refId: ref.id });
  }

  const { data: imports } = await c
    .from('import_records')
    .select('id, external_id, resulting_event_id, duplicate_event_id, source_id, source_url')
    .eq('resulting_event_id', madnessId);
  for (const record of imports ?? []) {
    const externalId = String(record.external_id ?? '');
    if (!MDMA_SOURCE_URL_PATTERN.test(externalId)) continue;
    if (!dryRun) {
      await c
        .from('import_records')
        .update({ resulting_event_id: null, duplicate_event_id: null })
        .eq('id', record.id);
      mutations += 1;
    }
    details.push({ action: 'unlink_mdma_import', recordId: record.id });
  }

  if (!dryRun) {
    const beforeLineup = await snapshotEventLineup(madnessId);
    if (!lineupIsEmpty(beforeLineup)) {
      await registry.eventLineupService.replaceStructuredLineupFromImport(madnessId, []);
      await registry.eventLineupService.replaceFromImportPipeline(madnessId, []);
      mutations += 2;
      details.push({ action: 'clear_contaminated_lineup', eventId: madnessId });
    } else {
      details.push({ action: 'skip_clear_lineup_already_empty', eventId: madnessId });
    }

    const { data: validImports } = await c
      .from('import_records')
      .select('*')
      .eq('resulting_event_id', madnessId);
    const { data: event } = await c
      .from('events')
      .select('title,ticket_url,website_url,description')
      .eq('id', madnessId)
      .maybeSingle();
    const mdmaInDescription = MDMA_SOURCE_URL_PATTERN.test(String(event?.description ?? ''));
    if (mdmaInDescription) {
      details.push({ action: 'description_contains_mdma_reference_manual_review', eventId: madnessId });
    }
    for (const record of validImports ?? []) {
      const candidate = getEffectiveCandidate(record as never);
      if (
        !importRecordMayContributeLineup({
          recordTitle: candidate.title ?? '',
          recordExternalUrls: [record.external_id, record.source_url].filter(Boolean) as string[],
          eventTitle: String(event?.title ?? ''),
          eventTicketUrl: event?.ticket_url ?? undefined,
          eventWebsiteUrl: event?.website_url ?? undefined,
        })
      ) {
        details.push({ action: 'skip_republish_ownership_mismatch', recordId: record.id });
        continue;
      }
      const result = await registry.importEventPublishService.repairLineupProjectionIfNeeded(
        record as never,
        madnessId,
      );
      if (result.wroteLineup) {
        mutations += 1;
        details.push({ action: 'republish_lineup', recordId: record.id, artistCount: result.artistIds.length });
      } else {
        details.push({ action: 'skip_republish_no_lineup_evidence', recordId: record.id });
      }
    }
    await invalidateConsumerEventCaches(registry.eventRepository);
  }

  return { phase: 'repair-ownership', at: new Date().toISOString(), mutations, details };
}

async function repairInvalidArtists(dryRun: boolean): Promise<RepairRun> {
  const registry = await loadRegistry();
  const c = opsClient();
  let mutations = 0;
  const details: unknown[] = [];
  const kitkatIds = [P0_EVENTS.kitkat2208, P0_EVENTS.kitkat2410];

  for (const eventId of kitkatIds) {
    const lineup = await snapshotEventLineup(eventId);
    const artistIds = new Set<string>();
    for (const entry of lineup.structuredEntries as Array<{
      event_lineup_entry_artists?: Array<{ artist_id?: string; artists?: { name?: string } | null }>;
    }>) {
      for (const link of entry.event_lineup_entry_artists ?? []) {
        const name = link.artists?.name ?? '';
        if (evaluateArtistCandidate({ name }).decision === 'invalid' && link.artist_id) {
          artistIds.add(link.artist_id);
        }
      }
    }
    for (const link of lineup.legacyArtists as Array<{
      artist_id?: string;
      artists?: { name?: string } | null;
    }>) {
      const name = link.artists?.name ?? '';
      if (evaluateArtistCandidate({ name }).decision === 'invalid' && link.artist_id) {
        artistIds.add(link.artist_id);
      }
    }

    if (!dryRun) {
      const beforeLineup = await snapshotEventLineup(eventId);
      if (!lineupIsEmpty(beforeLineup)) {
        await registry.eventLineupService.replaceStructuredLineupFromImport(eventId, []);
        await registry.eventLineupService.replaceFromImportPipeline(eventId, []);
        mutations += 2;
      } else {
        details.push({ action: 'skip_clear_lineup_already_empty', eventId });
      }

      const allArtists = await registry.adminArtistRepository.getAll();
      const artistsById = new Map(allArtists.map((artist) => [artist.id, artist]));
      const toMark = [...artistIds].filter((artistId) => {
        const artist = artistsById.get(artistId);
        return artist && !artist.lineupLegacyArtifact;
      });
      const marked = await markInvalidLineupArtifacts({
        artistIds: toMark,
        artistsById,
        saveArtist: (artist) => registry.adminArtistRepository.save(artist),
      });
      mutations += marked.markedLegacy.length;
      details.push({ eventId, clearedLineup: !lineupIsEmpty(beforeLineup), marked });
      await invalidateConsumerEventCaches(registry.eventRepository);
    } else {
      details.push({ eventId, invalidArtistIds: [...artistIds] });
    }
  }

  return { phase: 'repair-invalid-artists', at: new Date().toISOString(), mutations, details };
}

async function auditAfter() {
  const c = opsClient();
  const eventIds = Object.values(P0_EVENTS);
  const invalid = await collectInvalidArtistRows(eventIds);
  const madness = await snapshotEventLineup(P0_EVENTS.intoTheMadness);
  const mdma = await snapshotEventLineup(P0_EVENTS.mdma);
  const madnessRefs = await c
    .from('event_source_references')
    .select('source_id,external_event_id,original_url,active')
    .eq('canonical_event_id', P0_EVENTS.intoTheMadness);
  const mdmaOriginsOnMadness = (madnessRefs.data ?? []).filter((ref) =>
    MDMA_SOURCE_URL_PATTERN.test(String(ref.original_url ?? ref.external_event_id ?? '')),
  );
  const activeMdmaOriginsOnMadness = mdmaOriginsOnMadness.filter((ref) => ref.active !== false);

  const mdmaArtistIds = new Set<string>();
  for (const entry of mdma.structuredEntries as Array<{
    event_lineup_entry_artists?: Array<{ artist_id?: string }>;
  }>) {
    for (const link of entry.event_lineup_entry_artists ?? []) {
      if (link.artist_id) mdmaArtistIds.add(link.artist_id);
    }
  }

  const madnessNames = (madness.legacyArtists as Array<{ artists?: { name?: string } }>).map(
    (row) => row.artists?.name,
  );
  const mdmaOverlap = madnessNames.filter((name) =>
    (mdma.legacyArtists as Array<{ artists?: { name?: string } }>).some(
      (row) => normalizeMatchText(row.artists?.name ?? '') === normalizeMatchText(name ?? ''),
    ),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    invalidArtistCount: invalid.length,
    invalidArtists: invalid,
    intoTheMadnessArtistCount: madnessNames.length,
    mdmaOverlapCount: mdmaOverlap.length,
    mdmaStructuredEntries: (mdma.structuredEntries as unknown[]).length,
    mdmaArtistCount: mdmaArtistIds.size,
    mdmaOriginsOnMadnessActive: activeMdmaOriginsOnMadness.length,
    kitkatInvalid: invalid.filter((row) =>
      [P0_EVENTS.kitkat2208, P0_EVENTS.kitkat2410].includes((row as { eventId: string }).eventId as never),
    ).length,
    acceptance: {
      intoTheMadnessNoMdmaOrigins: activeMdmaOriginsOnMadness.length === 0,
      intoTheMadnessNoMdmaOverlap: mdmaOverlap.length === 0,
      mdmaStructuredEntriesOk: (mdma.structuredEntries as unknown[]).length === 9,
      mdmaArtistCountOk: mdmaArtistIds.size === 18,
      kitkatNoInvalidArtists:
        invalid.filter((row) =>
          [P0_EVENTS.kitkat2208, P0_EVENTS.kitkat2410].includes((row as { eventId: string }).eventId as never),
        ).length === 0,
      globalNoInvalidArtists: invalid.length === 0,
    },
  };
  writeJson(OUT_POST_AUDIT, payload);
  writeJson(OUT_INVALID, {
    generatedAt: payload.generatedAt,
    readOnly: true,
    artists: invalid,
  });
  return payload;
}

function buildReport(
  preflight: Record<string, unknown>,
  post: Record<string, unknown>,
  runs: RepairRun[],
) {
  const acceptance = (post.acceptance ?? {}) as Record<string, boolean>;
  const totalMutations = runs.reduce((sum, run) => sum + run.mutations, 0);
  const idempotent =
    runs.length >= 2 &&
    runs[runs.length - 1]!.mutations === 0 &&
    runs[runs.length - 2]!.mutations >= 0;

  const content = [
    '# Phase 4.6.9.1 — P0 Lineup Integrity Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Production repair status',
    '',
    `- Total repair mutations across runs: **${totalMutations}**`,
    `- Idempotent second pass: **${idempotent ? 'YES' : 'NO (see repair_runs.json)'}**`,
    '',
    '## Acceptance criteria',
    '',
    ...Object.entries(acceptance).map(([key, value]) => `- ${key}: **${value ? 'PASS' : 'FAIL'}**`),
    '',
    '## Preflight',
    '',
    `- Invalid artist rows in P0 set: **${preflight.invalidArtistCount}**`,
    '',
    '## Post-repair audit',
    '',
    `- Invalid artist rows: **${post.invalidArtistCount}**`,
    `- Into The Madness artist count: **${post.intoTheMadnessArtistCount}**`,
    `- MDMA overlap on Into The Madness: **${post.mdmaOverlapCount}**`,
    `- MDMA structured entries: **${post.mdmaStructuredEntries}** (expected 9)`,
    `- MDMA artist count: **${post.mdmaArtistCount}** (expected 18)`,
    `- Active MDMA origins on Into The Madness: **${post.mdmaOriginsOnMadnessActive}** (expected 0)`,
    '',
    '## Repair runs',
    '',
    ...runs.map(
      (run, index) =>
        `${index + 1}. **${run.phase}** @ ${run.at} — ${run.mutations} mutations`,
    ),
    '',
    '## Code changes (generic)',
    '',
    '- `artist-candidate-quality-gate.ts` — central gate before Artist create/link',
    '- `event-ownership-decision.ts` — ownership evidence + lineup contribution guard',
    '- `duplicate-detection-service.ts` — artist overlap cannot match alone',
    '- `import-publish-lineup-writer.ts` — blocks cross-title lineup writes',
    '',
    '## Remaining blockers (not P0)',
    '',
    '- P1 single structured writer cutover',
    '- P3 flyer reconciliation for detail-blocked events',
    '- `typecheck:operations` pre-existing `_audit-long-artist-ids.ts` failures (unrelated)',
    '',
  ].join('\n');
  writeFileSync(OUT_REPORT, content);
}

async function executeRepairPass(dryRun: boolean): Promise<RepairRun[]> {
  const runs: RepairRun[] = [];
  runs.push(await repairOwnership(dryRun));
  runs.push(await repairInvalidArtists(dryRun));
  return runs;
}

async function main() {
  const command = process.argv[2] ?? 'preflight';
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Phase 4.6.9.1 P0 lineup integrity — ${command}${dryRun ? ' (dry-run)' : ''}`);

  if (command === 'preflight') {
    const preflight = await runPreflight();
    console.log(`Preflight → ${OUT_PREFLIGHT} (invalid: ${preflight.invalidArtistCount})`);
    return;
  }

  if (command === 'backup') {
    const preflight = await runPreflight();
    await runBackup(preflight);
    console.log(`Backup → ${OUT_BACKUP}`);
    return;
  }

  const preflight = existsSync(OUT_PREFLIGHT)
    ? (JSON.parse(readFileSync(OUT_PREFLIGHT, 'utf8')) as Record<string, unknown>)
    : await runPreflight();

  if (command === 'audit-after') {
    const post = await auditAfter();
    console.log(`Post audit → ${OUT_POST_AUDIT} (invalid: ${post.invalidArtistCount})`);
    return;
  }

  if (command === 'report') {
    const post = existsSync(OUT_POST_AUDIT)
      ? (JSON.parse(readFileSync(OUT_POST_AUDIT, 'utf8')) as Record<string, unknown>)
      : await auditAfter();
    const runs = loadRuns();
    buildReport(preflight, post, runs);
    console.log(`Report → ${OUT_REPORT}`);
    return;
  }

  const runs = await executeRepairPass(dryRun);
  appendRuns(runs);
  const mutationTotal = runs.reduce((sum, run) => sum + run.mutations, 0);
  console.log(`Repair pass complete — ${mutationTotal} mutations`);

  if (command === 'full') {
    const post = await auditAfter();
    writeJson(OUT_BEFORE_AFTER, {
      generatedAt: new Date().toISOString(),
      preflight,
      post,
      runs: loadRuns(),
    });
    buildReport(preflight, post, loadRuns());
    console.log(`Post audit invalid artists: ${post.invalidArtistCount}`);
    console.log(`Report → ${OUT_REPORT}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
