/**
 * Phase 4.8.6.7.3 — Final live candidate rebuild + cutover manifest (read-only).
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import {
  acceptanceFixtureEventIds,
  BulkRebuildPreviewRunner,
  buildBulkRebuildHorizon,
  createBulkDetailFetchFn,
  runFixtureRebuildAcceptance,
} from '@/features/import/bulk-canonical-rebuild';

import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadHorizonEvents() {
  const { horizonStart, horizonEnd } = buildBulkRebuildHorizon();
  const { data, error } = await opsClient()
    .from('events')
    .select('*')
    .in('status', ['published', 'upcoming', 'running', 'ended'])
    .gte('start_date', horizonStart)
    .lte('start_date', horizonEnd);
  if (error) throw new Error(error.message);

  const events = ((data ?? []) as EventRow[]).map((row) => mapEventRowToAdminRecord(row));
  const fixtureIds = acceptanceFixtureEventIds();
  const missing = fixtureIds.filter((id) => !events.some((e) => e.id === id));
  if (missing.length > 0) {
    const { data: fixtureRows, error: fixtureError } = await opsClient()
      .from('events')
      .select('*')
      .in('id', missing);
    if (fixtureError) throw new Error(fixtureError.message);
    for (const row of (fixtureRows ?? []) as EventRow[]) {
      events.push(mapEventRowToAdminRecord(row));
    }
  }
  return events;
}

async function loadExistingByExternalForSource(sourceId: string) {
  const { data, error } = await opsClient()
    .from('import_records')
    .select('external_id,resulting_event_id')
    .eq('source_id', sourceId)
    .not('resulting_event_id', 'is', null);
  if (error) throw new Error(error.message);

  const eventIds = [...new Set((data ?? []).map((row) => row.resulting_event_id as string))];
  if (eventIds.length === 0) return new Map();

  const { data: events, error: eventError } = await opsClient().from('events').select('*').in('id', eventIds);
  if (eventError) throw new Error(eventError.message);

  const eventsById = new Map(
    ((events ?? []) as EventRow[]).map((row) => [row.id, mapEventRowToAdminRecord(row)]),
  );
  const map = new Map<string, ReturnType<typeof mapEventRowToAdminRecord>>();
  for (const row of data ?? []) {
    const event = eventsById.get(row.resulting_event_id as string);
    if (event && row.external_id) {
      map.set(row.external_id as string, event);
    }
  }
  return map;
}

async function loadManualLocksByEventIds(eventIds: string[]) {
  const locks = new Map<string, string[]>();
  if (eventIds.length === 0) return locks;

  const { data, error } = await opsClient()
    .from('event_field_provenance')
    .select('canonical_event_id,field_path,selected_source_id,manually_overridden')
    .in('canonical_event_id', eventIds);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const eventId = row.canonical_event_id as string;
    if (row.manually_overridden === true || row.selected_source_id === 'manual_override') {
      const list = locks.get(eventId) ?? [];
      list.push(row.field_path as string);
      locks.set(eventId, list);
    }
  }
  return locks;
}

async function loadActiveSources() {
  const { data, error } = await opsClient()
    .from('sources')
    .select('*')
    .eq('enabled', true)
    .eq('archived', false);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SourceRow[]).map((row) => mapSourceRowToRecord(row));
}

async function main(): Promise<void> {
  const existingEvents = await loadHorizonEvents();
  const activeSources = await loadActiveSources();
  const existingByExternalIdBySource = new Map();
  for (const source of activeSources) {
    existingByExternalIdBySource.set(source.id, await loadExistingByExternalForSource(source.id));
  }
  const manualLocksByEventId = await loadManualLocksByEventIds(existingEvents.map((e) => e.id));

  const runner = new BulkRebuildPreviewRunner();
  const result = await runner.run({
    existingEvents,
    activeSources,
    existingByExternalIdBySource,
    manualLocksByEventId,
    triggeredBy: 'phase48673-bulk-cutover-prep',
    enableHttpDetailFetch: true,
    detailFetchFn: createBulkDetailFetchFn(),
    detailFetchScope: 'references_and_candidates',
    referenceEventIds: acceptanceFixtureEventIds(),
  });

  const fixtureAcceptance = runFixtureRebuildAcceptance().acceptance;
  const safeCount = result.events.filter(
    (row) =>
      row.disposition === 'ready_unchanged' ||
      row.disposition === 'ready_update' ||
      row.disposition === 'ready_new' ||
      row.disposition === 'ready_partial',
  ).length;

  const readiness = {
    phase: '4.8.6.7.3',
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    fixtureAcceptancePassed: fixtureAcceptance.passed,
    liveAcceptancePassed: (result.acceptance as { liveAcceptance?: { passed?: boolean } }).liveAcceptance?.passed,
    manifestHash: (result.cutoverManifest as { manifestHash?: string } | undefined)?.manifestHash,
    safeCutoverCandidates: safeCount,
    detailFetchMetrics: result.detailFetchMetrics,
    metrics: result.metrics,
  };

  writeJson('_phase48673_live_fetch_metrics.json', result.detailFetchMetrics ?? {});
  writeJson('_phase48673_bulk_cutover_plan.json', result.cutoverManifest ?? {});
  writeJson('_phase48673_bulk_cutover_preview.json', {
    phase: result.phase,
    metrics: result.metrics,
    acceptance: result.acceptance,
    safeCandidateCount: safeCount,
  });
  writeJson('_phase48673_bulk_cutover_rollback.json', result.cutoverRollback ?? {});
  writeJson('_phase48673_bulk_cutover_readiness.json', readiness);

  console.log(
    JSON.stringify({
      phase: result.phase,
      productionMutationsInThisRun: 0,
      rolloutActivated: false,
      metrics: result.metrics,
      detailFetchMetrics: result.detailFetchMetrics,
      fixtureAcceptancePassed: fixtureAcceptance.passed,
      manifestHash: readiness.manifestHash,
      safeCutoverCandidates: safeCount,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
