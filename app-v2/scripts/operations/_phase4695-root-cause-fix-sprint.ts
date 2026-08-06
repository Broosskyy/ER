/**
 * Root Cause Fix Sprint — targeted production repair for proven audit failures only.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4695-root-cause-fix-sprint.ts [preflight|repair|full]
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import {
  isEventSpecificTicketUrl,
  isGenericTicketUrl,
  pickBestTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MATRIX_PATH = join(ROOT, 'docs/real-data/_phase469_global_event_trace_matrix.json');
const OUT_VALIDATION = join(ROOT, 'docs/real-data/_phase4695_validation.json');
const OUT_RUNS = join(ROOT, 'docs/real-data/_phase4695_repair_runs.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_4695_ROOT_CAUSE_FIX_SPRINT_REPORT.md');

const REFERENCE_EVENTS = [
  'evt-1785389054496-ns9b6la',
  'evt-1785389055557-ux20897',
  'evt-1785339383539-0lxvjlp',
  'evt-1785339386612-rjr91mv',
  'evt-1785339420043-obhyeev',
  'evt-1785339418526-dn9f7g0',
  'evt-1785506404218-hgmd9nz',
  'evt-1785506448834-4c5s8xl',
  'evt-1785339398765-9lptzhg',
  'evt-1785339392687-tbdwup4',
  'evt-1785339389636-v1tq3hw',
] as const;

type EventSnapshot = {
  ticketUrl: string | null;
  structuredCount: number;
  legacyCount: number;
  apiArtistNames: string[];
  titleInferenceProvenance: boolean;
  genericTicket: boolean;
};

type RepairDetail = {
  eventId: string;
  title: string;
  rootCause: string | null;
  before: EventSnapshot;
  after: EventSnapshot;
  actions: string[];
  rootCauseRemoved: boolean;
  remainingBlocker: string | null;
  winningOrigin: string | null;
  ticketUrlOrigin: string | null;
  lineupOrigin: string | null;
};

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function loadRuns(): Array<{ at: string; pass: number; mutations: number; details: RepairDetail[] }> {
  if (!existsSync(OUT_RUNS)) return [];
  return (JSON.parse(readFileSync(OUT_RUNS, 'utf8')) as { runs: [] }).runs ?? [];
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  return import('@/data/repositories/registry');
}

async function verifySafetyGate() {
  const c = opsClient();
  const { count: activeJobs } = await c
    .from('import_jobs')
    .select('id', { count: 'exact', head: true })
    .in('status', ['running', 'queued', 'processing']);
  if ((activeJobs ?? 0) > 0) {
    throw new Error(`Abort: ${activeJobs} active import jobs`);
  }
}

async function snapshotEvent(eventId: string): Promise<EventSnapshot> {
  const c = opsClient();
  const { data: event } = await c
    .from('events')
    .select('ticket_url')
    .eq('id', eventId)
    .maybeSingle();
  const { data: entries } = await c
    .from('event_lineup_entries')
    .select('id, provenance')
    .eq('event_id', eventId);
  const { count: legacyCount } = await c
    .from('event_artists')
    .select('artist_id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  const { data: legacy } = await c
    .from('event_artists')
    .select('artists(name)')
    .eq('event_id', eventId)
    .order('sort_order');
  const titleInferenceProvenance = (entries ?? []).some((entry) => {
    const prov = entry.provenance as { connector?: string; source?: string } | null;
    return prov?.connector === 'title_inference' || prov?.source === 'title_inferred_only';
  });
  return {
    ticketUrl: event?.ticket_url ?? null,
    structuredCount: entries?.length ?? 0,
    legacyCount: legacyCount ?? 0,
    apiArtistNames: (legacy ?? [])
      .map((row) => (row.artists as { name?: string } | null)?.name)
      .filter((name): name is string => Boolean(name)),
    titleInferenceProvenance,
    genericTicket: isGenericTicketUrl(event?.ticket_url),
  };
}

function loadTraceMatrix(): Array<Record<string, unknown>> {
  const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8')) as { events: Array<Record<string, unknown>> };
  return matrix.events;
}

function needsLiveRepair(before: EventSnapshot, trace: Record<string, unknown>): boolean {
  const rootCause = trace.rootCauseClass as string | null;
  if (before.titleInferenceProvenance) return true;
  if (rootCause === 'H_TITLE_INFERENCE_PROMOTED' && before.structuredCount > 0) return true;
  if (rootCause === 'G_DESCRIPTION_AS_LINEUP' && before.structuredCount > 4) return true;
  if (before.genericTicket) return true;
  if (before.apiArtistNames.some((n) => /more tba|&aelig|on:mode|\(a–z\)/i.test(n))) return true;
  return false;
}

async function collectTicketCandidates(eventId: string): Promise<string[]> {
  const c = opsClient();
  const { data: imports } = await c
    .from('import_records')
    .select('normalized_payload, source_url, source_id')
    .eq('resulting_event_id', eventId);
  const { data: refs } = await c
    .from('event_source_references')
    .select('original_url, external_event_id')
    .eq('canonical_event_id', eventId);
  const candidates: string[] = [];
  for (const row of imports ?? []) {
    const payload = (row.normalized_payload ?? {}) as { ticketUrl?: string; eventUrl?: string };
    if (payload.ticketUrl) candidates.push(payload.ticketUrl);
    if (payload.eventUrl) candidates.push(payload.eventUrl);
    if (row.source_url) candidates.push(row.source_url);
  }
  for (const ref of refs ?? []) {
    if (ref.original_url) candidates.push(String(ref.original_url));
    if (ref.external_event_id?.includes('ticket.io/')) candidates.push(String(ref.external_event_id));
  }
  return candidates;
}

async function repairEvent(
  eventId: string,
  trace: Record<string, unknown>,
  dryRun: boolean,
): Promise<{ mutations: number; detail: RepairDetail }> {
  const registry = await loadRegistry();
  const c = opsClient();
  const title = String(trace.title ?? eventId);
  const rootCause = (trace.rootCauseClass as string | null) ?? null;
  const before = await snapshotEvent(eventId);
  const actions: string[] = [];
  let mutations = 0;

  const forceLineupRebuild =
    rootCause === 'H_TITLE_INFERENCE_PROMOTED' ||
    rootCause === 'G_DESCRIPTION_AS_LINEUP' ||
    before.titleInferenceProvenance ||
    (trace.invalidArtistSignals as string[] | undefined)?.includes('prose_sentence');

  if (forceLineupRebuild && (before.structuredCount > 0 || before.legacyCount > 0)) {
    if (!dryRun) {
      await registry.eventLineupService.replaceStructuredLineupFromImport(eventId, []);
      await registry.eventLineupService.replaceFromImportPipeline(eventId, []);
      mutations += 2;
    }
    actions.push('clear_stale_lineup');
  }

  const { data: imports } = await c.from('import_records').select('*').eq('resulting_event_id', eventId);
  const { data: eventRow } = await c
    .from('events')
    .select('title,ticket_url,website_url')
    .eq('id', eventId)
    .maybeSingle();

  let winningOrigin: string | null = null;
  let lineupOrigin: string | null = null;
  for (const record of imports ?? []) {
    if (!dryRun && forceLineupRebuild) {
      const result = await registry.importEventPublishService.repairLineupProjectionIfNeeded(
        record as never,
        eventId,
      );
      if (result.wroteLineup) {
        mutations += 1;
        actions.push(`republish_lineup:${record.id}`);
        winningOrigin = String(record.source_id ?? '');
        lineupOrigin = result.source;
      }
    }
  }

  const ticketCandidates = await collectTicketCandidates(eventId);
  const bestTicket = pickBestTicketUrl([before.ticketUrl, ...ticketCandidates]);
  let ticketUrlOrigin: string | null = null;
  if (bestTicket && bestTicket !== before.ticketUrl && isEventSpecificTicketUrl(bestTicket)) {
    ticketUrlOrigin = 'import_candidate_merge';
    if (!dryRun) {
      await c.from('events').update({ ticket_url: bestTicket }).eq('id', eventId);
      mutations += 1;
    }
    actions.push(`ticket_url:${before.ticketUrl}→${bestTicket}`);
  }

  const after = dryRun ? before : await snapshotEvent(eventId);
  const remainingBlocker =
    (trace.detailBlocked as boolean) && after.structuredCount === 0
      ? 'external_detail_blocked'
      : null;

  const rootCauseRemoved =
    (rootCause === 'H_TITLE_INFERENCE_PROMOTED' && after.structuredCount === 0) ||
    (rootCause === 'G_DESCRIPTION_AS_LINEUP' &&
      after.structuredCount < before.structuredCount &&
      !after.apiArtistNames.some((n) => /more tba|&aelig|on:mode/i.test(n))) ||
    (before.genericTicket && isEventSpecificTicketUrl(after.ticketUrl));

  return {
    mutations,
    detail: {
      eventId,
      title,
      rootCause,
      before,
      after: dryRun ? before : after,
      actions,
      rootCauseRemoved,
      remainingBlocker,
      winningOrigin,
      ticketUrlOrigin,
      lineupOrigin,
    },
  };
}

async function runRepair(pass: number, dryRun: boolean) {
  const traces = loadTraceMatrix();
  let mutations = 0;
  const details: RepairDetail[] = [];

  for (const trace of traces) {
    const eventId = String(trace.eventId);
    const before = await snapshotEvent(eventId);
    if (!needsLiveRepair(before, trace)) {
      continue;
    }
    const result = await repairEvent(eventId, trace, dryRun);
    mutations += result.mutations;
    details.push(result.detail);
  }

  if (!dryRun) {
    const registry = await loadRegistry();
    await invalidateConsumerEventCaches(registry.eventRepository);
    writeJson(OUT_RUNS, {
      generatedAt: new Date().toISOString(),
      runs: [...loadRuns(), { at: new Date().toISOString(), pass, mutations, details }],
    });
  }

  return { mutations, details, targetCount: details.length };
}

async function runValidation() {
  const c = opsClient();
  const traces = loadTraceMatrix();
  const { data: events } = await c.from('events').select('id,title,ticket_url').eq('status', 'published');
  let titleInferenceRemaining = 0;
  let genericTicketRemaining = 0;
  let descriptionGarbage = 0;
  let correctLineups = 0;
  let correctTickets = 0;

  for (const event of events ?? []) {
    const snap = await snapshotEvent(event.id);
    if (snap.titleInferenceProvenance) titleInferenceRemaining += 1;
    if (snap.genericTicket) genericTicketRemaining += 1;
    if (snap.apiArtistNames.some((n) => /more tba|&aelig|on:mode|\(a–z\)/i.test(n))) {
      descriptionGarbage += 1;
    }
    if (isEventSpecificTicketUrl(snap.ticketUrl) || !snap.ticketUrl) {
      correctTickets += 1;
    }
    const trace = traces.find((t) => t.eventId === event.id);
    if (!trace?.rootCauseClass || (trace.pipelineHealthy === true && trace.modelConsistency === 'fully_aligned')) {
      correctLineups += 1;
    }
  }

  const reference = [];
  for (const eventId of REFERENCE_EVENTS) {
    const snap = await snapshotEvent(eventId);
    const trace = traces.find((t) => t.eventId === eventId);
    reference.push({
      eventId,
      title: trace?.title,
      structuredCount: snap.structuredCount,
      apiArtists: snap.apiArtistNames,
      ticketUrl: snap.ticketUrl,
      genericTicket: snap.genericTicket,
      titleInferenceProvenance: snap.titleInferenceProvenance,
    });
  }

  const metrics = {
    publishedEvents: events?.length ?? 0,
    titleInferenceRemaining,
    descriptionGarbageLineups: descriptionGarbage,
    genericTicketRemaining,
    correctTicketUrls: correctTickets,
    correctLineups,
    externalBlocked: traces.filter((t) => t.rootCauseClass === 'C_DETAIL_SOURCE_INACCESSIBLE').length,
    referenceEvents: reference,
  };
  writeJson(OUT_VALIDATION, { generatedAt: new Date().toISOString(), metrics });
  return metrics;
}

async function main() {
  const command = process.argv[2] ?? 'full';
  await verifySafetyGate();

  if (command === 'preflight' || command === 'full') {
    const metrics = await runValidation();
    console.log('Preflight metrics', metrics);
  }

  if (command === 'repair' || command === 'full') {
    const pass1 = await runRepair(1, false);
    console.log('Pass 1 mutations', pass1.mutations);
    const pass2 = await runRepair(2, false);
    console.log('Pass 2 mutations', pass2.mutations);
    if (pass2.mutations !== 0) {
      throw new Error(`Pass 2 expected 0 mutations, got ${pass2.mutations}`);
    }
    await runValidation();
    writeFileSync(
      OUT_REPORT,
      [
        '# Phase 4.6.9.5 Root Cause Fix Sprint',
        '',
        `Pass 1 mutations: ${pass1.mutations}`,
        `Pass 2 mutations: ${pass2.mutations}`,
        '',
        'See `docs/real-data/_phase4695_validation.json` and `_phase4695_repair_runs.json`.',
      ].join('\n'),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
