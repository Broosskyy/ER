/**
 * Phase 4.8.6.7 — Clean bulk canonical rebuild preview (read-only, no apply).
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
} from '@/features/import/bulk-canonical-rebuild';

import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadHorizonEvents(): Promise<ReturnType<typeof mapEventRowToAdminRecord>[]> {
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
  const missingFixtures = fixtureIds.filter((id) => !events.some((event) => event.id === id));
  if (missingFixtures.length > 0) {
    const { data: fixtureRows, error: fixtureError } = await opsClient()
      .from('events')
      .select('*')
      .in('id', missingFixtures);
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

async function loadManualLocksByEventIds(eventIds: string[]): Promise<Map<string, string[]>> {
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

async function loadActiveSources(): Promise<ReturnType<typeof mapSourceRowToRecord>[]> {
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
  const existingByExternalIdBySource = new Map<string, Map<string, ReturnType<typeof mapEventRowToAdminRecord>>>();
  for (const source of activeSources) {
    existingByExternalIdBySource.set(source.id, await loadExistingByExternalForSource(source.id));
  }
  const manualLocksByEventId = await loadManualLocksByEventIds(existingEvents.map((event) => event.id));

  const runner = new BulkRebuildPreviewRunner();
  const result = await runner.run({
    existingEvents,
    activeSources,
    existingByExternalIdBySource,
    manualLocksByEventId,
    triggeredBy: 'phase4867-bulk-rebuild-preview',
  });

  const readiness = {
    phase: result.phase,
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    acceptancePassed: result.acceptance.passed,
    fixtureAcceptancePassed: (result.acceptance as { fixtureAcceptance?: { passed?: boolean } }).fixtureAcceptance?.passed,
    liveAcceptancePassed: (result.acceptance as { liveAcceptance?: { passed?: boolean } }).liveAcceptance?.passed,
    blockingFailures: result.acceptance.blockingFailures,
    detailFetchMetrics: result.detailFetchMetrics,
    metrics: result.metrics,
    safeCutoverCandidates:
      result.events.filter(
        (row) =>
          row.disposition === 'ready_unchanged' ||
          row.disposition === 'ready_update' ||
          row.disposition === 'ready_new' ||
          row.disposition === 'ready_partial',
      ).length,
    reviewOrBlocked:
      result.events.filter(
        (row) =>
          row.disposition.startsWith('review_') ||
          row.disposition === 'blocked_contamination' ||
          row.disposition === 'archive_duplicate',
      ).length,
    rebuildReadinessBlocked: !result.acceptance.passed,
  };

  writeJson('_phase4867_bulk_rebuild_summary.json', {
    generatedAt: new Date().toISOString(),
    phase: result.phase,
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    horizon: result.horizon,
    metrics: result.metrics,
    detailFetchMetrics: result.detailFetchMetrics,
    acceptancePassed: result.acceptance.passed,
    fixtureAcceptancePassed: (result.acceptance as { fixtureAcceptance?: { passed?: boolean } }).fixtureAcceptance?.passed,
    liveAcceptancePassed: (result.acceptance as { liveAcceptance?: { passed?: boolean } }).liveAcceptance?.passed,
    blockingFailures: result.acceptance.blockingFailures,
  });
  writeJson('_phase4867_bulk_rebuild_events.json', result.events);
  writeJson('_phase4867_bulk_rebuild_source_coverage.json', result.sourceCoverage);
  writeJson('_phase4867_bulk_rebuild_acceptance.json', result.acceptance);
  writeJson('_phase4867_bulk_rebuild_cutover_plan.json', result.cutoverPlan);
  writeJson('_phase4867_bulk_rebuild_rollback_plan.json', result.rollbackPlan);
  writeJson('_phase4867_bulk_rebuild_readiness.json', readiness);

  console.log(
    JSON.stringify({
      phase: result.phase,
      productionMutationsInThisRun,
      rolloutActivated: false,
      horizon: result.horizon,
      metrics: result.metrics,
      acceptancePassed: result.acceptance.passed,
      blockingFailures: result.acceptance.blockingFailures,
      artifactsWritten: [
        '_phase4867_bulk_rebuild_summary.json',
        '_phase4867_bulk_rebuild_events.json',
        '_phase4867_bulk_rebuild_source_coverage.json',
        '_phase4867_bulk_rebuild_acceptance.json',
        '_phase4867_bulk_rebuild_cutover_plan.json',
        '_phase4867_bulk_rebuild_rollback_plan.json',
        '_phase4867_bulk_rebuild_readiness.json',
      ],
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
