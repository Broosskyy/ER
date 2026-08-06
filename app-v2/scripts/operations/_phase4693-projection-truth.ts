/**
 * Phase 4.6.9.3 — Canonical projection & API truth cutover.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4693-projection-truth.ts [command]
 *
 * Commands: inventory | audit | repair | cache-check | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateArtistCandidate } from '@/features/events/domain/artist-candidate-quality-gate';
import { PROJECTION_PATH_INVENTORY } from '@/features/events/domain/projection-path-inventory';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildLineupBillingRows } from '@/features/event-detail/utils/lineup-billing-display';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import type { Event } from '@/features/events/types/event';
import { opsClient } from './ops-supabase-rows';

function projectEventLineup(event: Event) {
  const canonical = projectCanonicalEventFields({
    title: event.title,
    description: event.description,
    venue: event.venue,
    city: event.city,
    artists: event.artists,
    lineup: event.lineup,
    priceText: event.priceText,
    source: event.source,
    ticketUrl: event.ticketUrl,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    countryCode: event.country,
    latitude: event.latitude,
    longitude: event.longitude,
    timezone: event.timezone,
    organizer: event.organizer,
    imageUrl: event.imageUrl,
    genres: event.genres,
    lineupEntries: event.lineupEntries,
  });

  const uiArtists =
    canonical.lineupEntries.length > 0
      ? buildLineupBillingRows({
          lineupEntries: canonical.lineupEntries,
          artistIds: event.artistIds,
          knownArtistNames: canonical.knownArtistNames,
        }).flatMap((row) => row.artists.map((artist) => artist.name))
      : canonical.knownArtistNames;

  return {
    apiArtists: canonical.knownArtistNames,
    apiLineupEntries: canonical.lineupEntries.length,
    uiArtists,
  };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_INVENTORY = join(ROOT, 'docs/real-data/_phase4693_projection_inventory.json');
const OUT_BEFORE_AFTER = join(ROOT, 'docs/real-data/_phase4693_projection_before_after.json');
const OUT_API_CONSISTENCY = join(ROOT, 'docs/real-data/_phase4693_api_consistency.json');
const OUT_CACHE = join(ROOT, 'docs/real-data/_phase4693_cache_validation.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_4693_PROJECTION_TRUTH_REPORT.md');

const REPRESENTATIVE_EVENTS = {
  sommerfest: 'evt-1785389055557-ux20897',
  mdma: 'evt-1785389054496-ns9b6la',
  levi: 'evt-1785339383539-0lxvjlp',
  bootshausOnShipIII: 'evt-1785339420043-obhyeev',
  bootshausOnShipIV: 'evt-1785339418526-dn9f7g0',
  intoTheMadness: 'evt-1785339386612-rjr91mv',
  blacklistFestival: 'evt-1785339398765-9lptzhg',
  visionEkstase: 'evt-1785506404218-hgmd9nz',
  pureTechno: 'evt-1785506448834-4c5s8xl',
  kitkatClub: 'evt-1785339389636-v1tq3hw',
} as const;

type ApiLineupClass = 'structured' | 'compatibility' | 'empty' | 'prose_violation';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  await registry.eventRepository.refresh();
  return registry;
}

async function snapshotDbLineup(eventId: string) {
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
  const { data: event } = await c
    .from('events')
    .select('id, title, artist_id, artists(name)')
    .eq('id', eventId)
    .maybeSingle();
  return { structuredEntries: entries ?? [], legacyArtists: legacy ?? [], event };
}

function classifyApiLineup(
  structuredCount: number,
  legacyCount: number,
  apiArtistNames: string[],
): ApiLineupClass {
  const prose = apiArtistNames.some(
    (name) => evaluateArtistCandidate({ name, sourceField: 'lineup' }).decision === 'invalid',
  );
  if (prose) {
    return 'prose_violation';
  }
  if (structuredCount > 0) {
    return 'structured';
  }
  if (legacyCount > 0) {
    return 'compatibility';
  }
  return 'empty';
}

function runInventory() {
  const payload = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    paths: PROJECTION_PATH_INVENTORY,
    canonicalReadOrder: ['structured lineup entries', 'compatibility event_artists', 'explicit empty'],
    forbiddenFallbacks: [
      'events.artist_id primary artist',
      'title inference',
      'description fragments',
      'HTML blobs',
    ],
  };
  writeJson(OUT_INVENTORY, payload);
  return payload;
}

async function runAudit() {
  const registry = await loadRegistry();
  const c = opsClient();
  const { data: events } = await c.from('events').select('id,title').eq('status', 'published');
  const classifications: Record<string, unknown> = {};
  let proseViolations = 0;
  let primaryArtistFallbacks = 0;
  let projectionMismatches = 0;

  for (const row of events ?? []) {
    const eventId = String(row.id);
    const db = await snapshotDbLineup(eventId);
    const event = await registry.eventRepository.getEventById(eventId);
    if (!event) {
      continue;
    }
    const projected = projectEventLineup(event);
    const apiArtists = projected.apiArtists;
    const uiArtists = projected.uiArtists;
    const classification = classifyApiLineup(
      db.structuredEntries.length,
      db.legacyArtists.length,
      apiArtists,
    );
    if (classification === 'prose_violation') {
      proseViolations += 1;
    }
    const primaryArtistName = (db.event as { artists?: { name?: string } | null })?.artists?.name;
    const hasPrimaryOnly =
      db.structuredEntries.length === 0 &&
      db.legacyArtists.length === 0 &&
      Boolean((db.event as { artist_id?: string | null })?.artist_id) &&
      apiArtists.length === 0;
    if (hasPrimaryOnly && primaryArtistName) {
      primaryArtistFallbacks += 1;
    }
    const mismatch =
      apiArtists.join('|').toLowerCase() !== uiArtists.join('|').toLowerCase();
    if (mismatch) {
      projectionMismatches += 1;
    }
    classifications[eventId] = {
      title: row.title,
      classification,
      structuredCount: db.structuredEntries.length,
      legacyCount: db.legacyArtists.length,
      apiArtists,
      uiArtists,
      primaryArtistId: (db.event as { artist_id?: string | null })?.artist_id ?? null,
      primaryArtistName: primaryArtistName ?? null,
      projectionMismatch: mismatch,
    };
  }

  const metrics = {
    publishedEvents: (events ?? []).length,
    proseViolations,
    primaryArtistFallbacks,
    projectionMismatches,
    structured: Object.values(classifications).filter((row) => (row as { classification: string }).classification === 'structured').length,
    compatibility: Object.values(classifications).filter((row) => (row as { classification: string }).classification === 'compatibility').length,
    empty: Object.values(classifications).filter((row) => (row as { classification: string }).classification === 'empty').length,
    proseState: proseViolations,
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    metrics,
    classifications,
  };
  writeJson(OUT_API_CONSISTENCY, payload);
  return payload;
}

async function runRepresentativeTrace() {
  const registry = await loadRegistry();
  const traces: Record<string, unknown> = {};
  for (const [label, eventId] of Object.entries(REPRESENTATIVE_EVENTS)) {
    const db = await snapshotDbLineup(eventId);
    const event = await registry.eventRepository.getEventById(eventId);
    const projected = event ? projectEventLineup(event) : null;
    traces[label] = {
      eventId,
      structuredDbCount: db.structuredEntries.length,
      legacyDbCount: db.legacyArtists.length,
      apiArtists: projected?.apiArtists ?? [],
      apiLineupEntries: projected?.apiLineupEntries ?? 0,
      uiArtists: projected?.uiArtists ?? [],
      uiBillingRows:
        event && event.lineupEntries && event.lineupEntries.length > 0
          ? buildLineupBillingRows({
              lineupEntries: event.lineupEntries,
              artistIds: event.artistIds,
              knownArtistNames: projected?.apiArtists ?? [],
            }).length
          : 0,
      aligned:
        (projected?.apiArtists ?? []).join('|').toLowerCase() ===
        (projected?.uiArtists ?? []).join('|').toLowerCase(),
    };
  }
  return traces;
}

async function runRepair(dryRun: boolean) {
  const c = opsClient();
  const registry = await loadRegistry();
  let mutations = 0;
  const details: unknown[] = [];

  const { data: events } = await c.from('events').select('id,title,artist_id').eq('status', 'published');
  for (const row of events ?? []) {
    const eventId = String(row.id);
    const db = await snapshotDbLineup(eventId);
    const hasLineup = db.structuredEntries.length > 0 || db.legacyArtists.length > 0;
    const primaryArtistId = (row as { artist_id?: string | null }).artist_id;

    if (!hasLineup && primaryArtistId) {
      const primaryName = (db.event as { artists?: { name?: string } | null })?.artists?.name ?? '';
      const invalidPrimary =
        !primaryName ||
        evaluateArtistCandidate({ name: primaryName, sourceField: 'lineup' }).decision === 'invalid';
      if (invalidPrimary) {
        if (!dryRun) {
          await c.from('events').update({ artist_id: null }).eq('id', eventId);
          mutations += 1;
        }
        details.push({ action: 'clear_stale_primary_artist', eventId, primaryArtistId, primaryName });
      }
    }

    if (db.structuredEntries.length > 0) {
      const before = await registry.eventLineupService.getLineupArtistIds(eventId);
      if (!dryRun) {
        await registry.eventLineupService.syncCompatibilityProjection(eventId);
      }
      const after = dryRun ? before : await registry.eventLineupService.getLineupArtistIds(eventId);
      if (before.join(',') !== after.join(',')) {
        if (!dryRun) mutations += 1;
        details.push({ action: 'sync_compatibility_projection', eventId, before, after });
      }
    }
  }

  if (!dryRun && mutations > 0) {
    await invalidateConsumerEventCaches(registry.eventRepository);
  }

  return { mutations, details };
}

async function runCacheCheck() {
  const registry = await loadRegistry();
  await registry.eventRepository.refresh();
  const events = await registry.eventRepository.getPublishedEvents();
  let mismatches = 0;
  const samples: unknown[] = [];
  for (const event of events.slice(0, 50)) {
    const projected = projectEventLineup(event);
    const invalid = projected.apiArtists.filter(
      (name) => evaluateArtistCandidate({ name, sourceField: 'lineup' }).decision === 'invalid',
    );
    if (invalid.length > 0) {
      mismatches += 1;
      samples.push({ eventId: event.id, title: event.title, invalid });
    }
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    sampledEvents: Math.min(events.length, 50),
    cacheProseViolations: mismatches,
    samples,
  };
  writeJson(OUT_CACHE, payload);
  return payload;
}

function buildReport(input: {
  inventory: Record<string, unknown>;
  audit: Record<string, unknown>;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  cache: Record<string, unknown>;
  repairRuns: Array<{ mutations: number }>;
  representatives: Record<string, unknown>;
}) {
  const beforeMetrics = (input.before.metrics ?? {}) as Record<string, number>;
  const afterMetrics = (input.after.metrics ?? {}) as Record<string, number>;
  const idempotent =
    input.repairRuns.length >= 2 && input.repairRuns[input.repairRuns.length - 1]!.mutations === 0;

  const content = [
    '# Phase 4.6.9.3 — Canonical Projection & API Truth Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Canonical read path',
    '',
    '1. `event_lineup_entries` (structured)',
    '2. `event_artists` (compatibility)',
    '3. explicit empty lineup',
    '',
    'Forbidden: `events.artist_id`, title inference, description/HTML prose.',
    '',
    '## Before / after metrics',
    '',
    `| Metric | Before | After |`,
    `|--------|--------|-------|`,
    `| API prose violations | ${beforeMetrics.proseViolations ?? 0} | ${afterMetrics.proseViolations ?? 0} |`,
    `| Primary artist fallbacks | ${beforeMetrics.primaryArtistFallbacks ?? 0} | ${afterMetrics.primaryArtistFallbacks ?? 0} |`,
    `| Projection mismatches | ${beforeMetrics.projectionMismatches ?? 0} | ${afterMetrics.projectionMismatches ?? 0} |`,
  `| Structured events | ${beforeMetrics.structured ?? 0} | ${afterMetrics.structured ?? 0} |`,
    `| Empty lineup events | ${beforeMetrics.empty ?? 0} | ${afterMetrics.empty ?? 0} |`,
    '',
    '## Representative events',
    '',
    ...Object.entries(input.representatives).map(
      ([label, row]) =>
        `- **${label}**: aligned=${(row as { aligned?: boolean }).aligned} api=${JSON.stringify((row as { apiArtists?: string[] }).apiArtists)}`,
    ),
    '',
    '## Controlled repair',
    '',
    `- Repair runs: ${input.repairRuns.length}`,
    `- Final pass idempotent: **${idempotent ? 'YES' : 'NO'}**`,
    '',
    '## Remaining evidence blockers (pre-4.7)',
    '',
    '- Bootshaus on a Ship IV: no structured evidence; requires detail/flyer extraction',
    '- Blacklist Festival: structured parser artifacts need evidence-backed re-extraction',
    '- LOONYLAND duplicate artist variant needs entity merge, not projection-only repair',
    '',
    '## Flyer reconciliation recommendation',
    '',
    'Start Phase 4.7 with accepted flyer evidence as structured candidate input only; never as API fallback.',
    '',
  ].join('\n');
  writeFileSync(OUT_REPORT, content);
}

async function main() {
  const command = process.argv[2] ?? 'report';
  const inventory = runInventory();

  if (command === 'inventory') {
    console.log('Projection inventory written.');
    return;
  }

  if (command === 'audit') {
    const audit = await runAudit();
    console.log(JSON.stringify(audit.metrics, null, 2));
    return;
  }

  if (command === 'repair') {
    const result = await runRepair(false);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'cache-check') {
    const cache = await runCacheCheck();
    console.log(JSON.stringify(cache, null, 2));
    return;
  }

  if (command === 'full' || command === 'report') {
    const beforeAudit = await runAudit();
    const representatives = await runRepresentativeTrace();
    writeJson(OUT_BEFORE_AFTER, {
      generatedAt: new Date().toISOString(),
      phase: 'before',
      metrics: beforeAudit.metrics,
      representatives,
    });

    const repairRuns: Array<{ mutations: number }> = [];
    repairRuns.push(await runRepair(false));
    repairRuns.push(await runRepair(false));

    const afterAudit = await runAudit();
    const cache = await runCacheCheck();
    writeJson(OUT_BEFORE_AFTER, {
      generatedAt: new Date().toISOString(),
      before: beforeAudit.metrics,
      after: afterAudit.metrics,
      representatives,
      repairRuns,
    });

    buildReport({
      inventory,
      audit: afterAudit,
      before: { metrics: beforeAudit.metrics },
      after: { metrics: afterAudit.metrics },
      cache,
      repairRuns,
      representatives,
    });
    console.log(JSON.stringify({ before: beforeAudit.metrics, after: afterAudit.metrics, repairRuns }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
