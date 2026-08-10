/**
 * Phase 4.8.6.7.3 — Live reference validation (seven acceptance events only).
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import {
  BULK_REBUILD_ACCEPTANCE_FIXTURES,
  BulkRebuildPreviewRunner,
  buildBulkRebuildHorizon,
  createBulkDetailFetchFn,
  runFixtureRebuildAcceptance,
} from '@/features/import/bulk-canonical-rebuild';
import { buildLiveReferenceMatrix } from '@/features/import/bulk-canonical-rebuild/live-reference-validation';

import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadReferenceEvents() {
  const ids = BULK_REBUILD_ACCEPTANCE_FIXTURES.map((f) => f.eventId);
  const { data, error } = await opsClient().from('events').select('*').in('id', ids);
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map((row) => mapEventRowToAdminRecord(row));
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
  const referenceEventIds = BULK_REBUILD_ACCEPTANCE_FIXTURES.map((f) => f.eventId);
  const existingEvents = await loadReferenceEvents();
  const activeSources = await loadActiveSources();
  const existingByExternalIdBySource = new Map();
  for (const source of activeSources) {
    existingByExternalIdBySource.set(source.id, await loadExistingByExternalForSource(source.id));
  }

  const runner = new BulkRebuildPreviewRunner();
  const result = await runner.run({
    existingEvents,
    activeSources,
    existingByExternalIdBySource,
    manualLocksByEventId: new Map(),
    triggeredBy: 'phase48673-live-reference-validation',
    enableHttpDetailFetch: true,
    detailFetchFn: createBulkDetailFetchFn(),
    detailFetchScope: 'references_and_candidates',
    referenceEventIds,
  });

  const matrix = buildLiveReferenceMatrix(
    result.events,
    BULK_REBUILD_ACCEPTANCE_FIXTURES.map((f) => ({ key: f.key, eventId: f.eventId })),
  );
  const fixtureAcceptance = runFixtureRebuildAcceptance().acceptance;

  writeJson('_phase48673_live_reference_validation.json', {
    phase: '4.8.6.7.3',
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    horizon: buildBulkRebuildHorizon(),
    fixtureAcceptancePassed: fixtureAcceptance.passed,
    liveReferenceMatrix: matrix,
    detailFetchMetrics: result.detailFetchMetrics,
  });
  writeJson('_phase48673_live_fetch_metrics.json', result.detailFetchMetrics ?? {});

  console.log(
    JSON.stringify({
      phase: '4.8.6.7.3',
      productionMutationsInThisRun: 0,
      fixtureAcceptancePassed: fixtureAcceptance.passed,
      pipelineMissingEvidence: matrix.pipelineMissingEvidenceCount,
      entries: matrix.entries,
      detailFetchMetrics: result.detailFetchMetrics,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
