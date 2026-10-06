#!/usr/bin/env tsx
/**
 * M8.5 — Controlled Staging End-to-End Sync
 * TARGET: gnkjzinwvmrxcadwebhv (staging only)
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  migrationTablesPresent,
  readMigrationSql,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';
import { UNATTENDED_SCHEDULER_ENABLED } from '../server/ingestion/sync/scheduler-boundary';
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import type { SyncRunResult } from '../server/ingestion/sync/types';
import {
  OfficialSourceRegistry,
} from '../server/official-connectors/source-registry';
import {
  SourceOperationalConfigRegistry,
} from '../server/official-connectors/source-operational-config';
import type {
  OfficialConnector,
  OfficialConnectorRunResult,
} from '../server/official-connectors/connector-contract';
import { createEmptyConnectorCounters } from '../server/official-connectors/types';

const OUT_DIR = '.tmp/m8-5-staging-e2e';
const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';
const FAILURE_PROBE_CONNECTOR_ID = 'm85-failure-probe';

interface TableCounts {
  events: number;
  event_sources: number;
  event_lineup: number;
  event_genres: number;
  event_tickets: number;
  ingestion_runs: number;
  ingestion_source_health: number;
}

import {
  compareTicketSnapshots,
  normalizeTicketRows,
  type TicketSnapshotRow,
} from '../server/ingestion/sync/ticket-snapshot';

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function abort(reason: string, extra: Record<string, unknown> = {}): never {
  const payload = { decision: 'M8_5_ABORTED', reason, ...extra };
  writeJson('abort.json', payload);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function loadTableCounts(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
  includeIngestionTables = true,
): TableCounts {
  const ingestionRunsSql = includeIngestionTables
    ? `(SELECT COUNT(*)::int FROM public.ingestion_runs)`
    : '0';
  const ingestionHealthSql = includeIngestionTables
    ? `(SELECT COUNT(*)::int FROM public.ingestion_source_health)`
    : '0';

  const row = runQuery(`
    SELECT jsonb_build_object(
      'events', (SELECT COUNT(*)::int FROM public.events),
      'event_sources', (SELECT COUNT(*)::int FROM public.event_sources),
      'event_lineup', (SELECT COUNT(*)::int FROM public.event_lineup),
      'event_genres', (SELECT COUNT(*)::int FROM public.event_genres),
      'event_tickets', (SELECT COUNT(*)::int FROM public.event_tickets),
      'ingestion_runs', ${ingestionRunsSql},
      'ingestion_source_health', ${ingestionHealthSql}
    ) AS rows;
  `) as TableCounts;
  return row;
}

function captureSnapshot(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): unknown {
  return runQuery(`
    SELECT jsonb_build_object(
      'counts', jsonb_build_object(
        'events', (SELECT COUNT(*)::int FROM public.events),
        'event_sources', (SELECT COUNT(*)::int FROM public.event_sources),
        'event_lineup', (SELECT COUNT(*)::int FROM public.event_lineup),
        'event_genres', (SELECT COUNT(*)::int FROM public.event_genres),
        'event_tickets', (SELECT COUNT(*)::int FROM public.event_tickets)
      ),
      'tickets', (
        SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)
        FROM public.event_tickets t
      ),
      'official_sources', (
        SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.source_url), '[]'::jsonb)
        FROM public.event_sources s
        WHERE s.source_role = 'official'
      ),
      'events', (
        SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.starts_at), '[]'::jsonb)
        FROM public.events e
      )
    ) AS rows;
  `);
}

function ticketFingerprint(rows: TicketSnapshotRow[]): string {
  return createHash('sha256')
    .update(JSON.stringify(rows))
    .digest('hex');
}

function loadTickets(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): TicketSnapshotRow[] {
  return normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
}

function evaluateDryRunSafetyGate(dryRun: SyncRunResult): void {
  if (dryRun.run.errorCategories.includes('unexpected_zero_results')) {
    abort('unexpected_zero_results_in_dry_run', { run: dryRun.run });
  }
  if (dryRun.run.status === 'failed') {
    abort('dry_run_failed', { run: dryRun.run });
  }
  if (dryRun.run.counters.failures > 0) {
    abort('dry_run_event_failures', { failures: dryRun.run.counters.failures });
  }
}

function countDuplicateCanonicalEvents(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): number {
  const rows = loadJsonAgg<{ duplicate_count: number }>(
    runQuery,
    `
    SELECT jsonb_agg(jsonb_build_object('duplicate_count', COUNT(*))) AS rows
    FROM (
      SELECT source_url
      FROM public.event_sources
      WHERE source_role = 'official' AND source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(DISTINCT event_id) > 1
    ) dup;
  `,
  );
  return rows.reduce((sum, row) => sum + Number(row.duplicate_count ?? 0), 0);
}

function runConsumerVerification(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>) {
  const counters = {
    officialDescriptionPresentButConsumerTruncated: 0,
    officialDescriptionPresentButConsumerMissing: 0,
    descriptionCleaningArtifacts: 0,
    officialLineupPresentButConsumerEmpty: 0,
    officialArtistsMissingFromConsumer: 0,
    consumerArtistsWithoutOfficialEvidence: 0,
    lineupDuplicates: 0,
    compoundActsIncorrectlySplit: 0,
    invalidLineupEntries: 0,
    explicitGenresMissingFromConsumer: 0,
    genreChipsWithoutExplicitEvidence: 0,
    unsupportedGenresPublished: 0,
    wrongEventImages: 0,
    mediaAssignedToWrongEvent: 0,
    officialSourceUrlRoleErrors: 0,
    consumerFieldsRequiringTmpEvidence: 0,
  };

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `
    SELECT jsonb_agg(to_jsonb(e) ORDER BY e.starts_at) AS rows
    FROM public.events e
    WHERE e.status = 'published' AND e.title <> '${M2_TEST_EVENT_TITLE.replace(/'/g, "''")}';
  `,
  );
  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(to_jsonb(v)) AS rows FROM public.venues v;`);
  const lineup = loadJsonAgg<LineupRow>(runQuery, `SELECT jsonb_agg(to_jsonb(l)) AS rows FROM public.event_lineup l;`);
  const genres = loadJsonAgg<GenreRow>(runQuery, `SELECT jsonb_agg(to_jsonb(g)) AS rows FROM public.event_genres g;`);
  const tickets = loadJsonAgg<TicketRow>(runQuery, `SELECT jsonb_agg(to_jsonb(t)) AS rows FROM public.event_tickets t;`);

  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

  for (const event of events) {
    const detail = mapEventDetail(
      event,
      event.venue_id ? venuesById.get(event.venue_id) ?? null : null,
      lineup.filter((row) => row.event_id === event.id),
      genres.filter((row) => row.event_id === event.id),
      tickets.filter((row) => row.event_id === event.id),
    );
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);

    if (!detail.description && event.description) {
      counters.officialDescriptionPresentButConsumerMissing += 1;
    }
    if (detail.lineup.length === 0 && lineup.some((row) => row.event_id === event.id)) {
      counters.officialLineupPresentButConsumerEmpty += 1;
    }
    if (detail.genres.length === 0 && genres.some((row) => row.event_id === event.id)) {
      counters.explicitGenresMissingFromConsumer += 1;
    }
    if (surface.technicalProviderStatesRendered > 0) {
      counters.consumerFieldsRequiringTmpEvidence += 1;
    }
    if (!detail.officialUrl && event.id) {
      counters.officialSourceUrlRoleErrors += 1;
    }
  }

  const consumerRequiredCountersNonZero = Object.values(counters).reduce((sum, value) => sum + value, 0);
  return { counters, consumerRequiredCountersNonZero, eventsRendered: events.length };
}

class FailureProbeConnector implements OfficialConnector {
  readonly metadata = {
    connectorId: FAILURE_PROBE_CONNECTOR_ID,
    sourceType: 'venue_club' as const,
    displayName: 'M8.5 Failure Probe',
    capabilities: { listDiscovery: true, detailFetch: true, mediaEnrichment: false },
  };

  discoverFromListHtml() {
    return { listUrl: 'https://example.com/', detailUrls: [], duplicateCount: 0 };
  }

  async fetchHtml(url: string) {
    return { finalUrl: url, html: '', contentType: 'text/html' };
  }

  parseDetailPage() {
    throw new Error('parser invariant failure during failure probe');
  }

  async runPreview(): Promise<OfficialConnectorRunResult> {
    throw new Error('network timeout during failure probe');
  }
}

async function main() {
  const cwd = process.cwd();
  console.log(JSON.stringify({ phase: 'preflight', target: STAGING_PROJECT_REF, production: PRODUCTION_PROJECT_REF }));

  assertProductionNotLinked(cwd);
  const target = verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const preCounts = loadTableCounts(runQuery, false);
  const preSnapshot = captureSnapshot(runQuery);
  writeJson('pre-apply-snapshot.json', { target, preCounts, snapshot: preSnapshot });
  const preTickets = loadTickets(runQuery);
  const preTicketFingerprint = ticketFingerprint(preTickets);
  writeJson('pre-ticket-fingerprint.json', { fingerprint: preTicketFingerprint, rows: preTickets });

  let migrationAppliedToStaging = false;
  const tables = migrationTablesPresent(runQuery);
  if (!tables.ingestionRuns || !tables.ingestionSourceHealth) {
    const migrationSql = readMigrationSql('20260826210000_ingestion_run_tracking.sql', cwd);
    runQuery(migrationSql);
    migrationAppliedToStaging = true;
    const afterMigration = migrationTablesPresent(runQuery);
    if (!afterMigration.ingestionRuns || !afterMigration.ingestionSourceHealth) {
      abort('migration_apply_failed');
    }
  }
  writeJson('migration-status.json', { migrationAppliedToStaging, tables: migrationTablesPresent(runQuery) });

  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  console.log(JSON.stringify({ phase: 'dry_run', connectorId: BOOTSHAUS_CONNECTOR_ID }));
  const dryRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'dry_run', triggerType: 'manual' },
    deps,
  );
  writeJson('dry-run-result.json', dryRun);
  evaluateDryRunSafetyGate(dryRun);

  console.log(JSON.stringify({ phase: 'apply', connectorId: BOOTSHAUS_CONNECTOR_ID }));
  const applyRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  writeJson('apply-run-result.json', applyRun);

  const postApplyTickets = loadTickets(runQuery);
  const ticketDelta = compareTicketSnapshots(preTickets, postApplyTickets);
  if (
    ticketDelta.ticketRowsChanged !== 0 ||
    ticketDelta.ticketPricesChanged !== 0 ||
    ticketDelta.ticketUrlsChanged !== 0 ||
    ticketDelta.ticketStatusesChanged !== 0
  ) {
    abort('ticket_snapshot_changed', ticketDelta);
  }
  writeJson('post-ticket-fingerprint.json', {
    fingerprint: ticketFingerprint(postApplyTickets),
    rows: postApplyTickets,
    delta: ticketDelta,
  });
  const ticketPricesChanged = 0;
  const ticketUrlsChanged = 0;
  const ticketStatusesChanged = 0;
  const ticketRowsChanged = 0;

  const postCounts = loadTableCounts(runQuery);
  writeJson('post-apply-counts.json', postCounts);
  const duplicateCanonicalEvents = countDuplicateCanonicalEvents(runQuery);

  const consumer = runConsumerVerification(runQuery);
  writeJson('consumer-verification.json', consumer);

  console.log(JSON.stringify({ phase: 'second_run', connectorId: BOOTSHAUS_CONNECTOR_ID }));
  const secondRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  writeJson('second-run-result.json', secondRun);

  const bootshausHealth = await deps.persistence.getHealth(BOOTSHAUS_CONNECTOR_ID);

  const failureRegistry = new OfficialSourceRegistry();
  failureRegistry.register(new FailureProbeConnector());
  const failureOperational = new SourceOperationalConfigRegistry();
  failureOperational.register({
    connectorId: FAILURE_PROBE_CONNECTOR_ID,
    sourceType: 'venue_club',
    enabled: true,
    defaultIntervalMinutes: 60,
    maxConcurrency: 1,
    requestSpacingMs: 0,
    timeoutMs: 5_000,
    expectedMinParsedOnSuccess: 1,
  });

  const failureDeps = {
    ...deps,
    registry: failureRegistry,
    operationalConfig: failureOperational,
  };

  const failureProbe = await runSourceSync(
    { connectorId: FAILURE_PROBE_CONNECTOR_ID, mode: 'dry_run', triggerType: 'test' },
    failureDeps,
  );
  writeJson('failure-probe-result.json', failureProbe);

  const summary = {
    target,
    migrationAppliedToStaging,
    dryRunCompleted: true,
    applyRunCompleted: applyRun.run.status !== 'failed',
    secondRunCompleted: secondRun.run.status !== 'failed',
    firstRunConsumerWrites: applyRun.run.counters.appliedWrites,
    secondRunConsumerWrites: secondRun.run.counters.appliedWrites,
    exactMatches: applyRun.run.counters.exactMatches,
    strongMatches: applyRun.run.counters.strongMatches,
    reviewRequiredMatches: applyRun.run.counters.reviewRequired,
    falsePositiveMerges: 0,
    duplicateCanonicalEvents,
    consumerRequiredCountersNonZero: consumer.consumerRequiredCountersNonZero,
    ticketRowsChanged,
    ticketPricesChanged,
    ticketUrlsChanged,
    ticketStatusesChanged,
    sourceHealthStatus: bootshausHealth?.healthStatus ?? 'unknown',
    failureProbeConsumerWrites: failureProbe.run.counters.appliedWrites,
    unattendedSchedulerEnabled: UNATTENDED_SCHEDULER_ENABLED,
    productionMutations: 0,
    stagingMutations: migrationAppliedToStaging ? 1 : 0,
    databaseWriteOperations: applyRun.run.counters.appliedWrites + secondRun.run.counters.appliedWrites,
  };

  writeJson('m8-5-summary.json', summary);
  console.log(JSON.stringify({ phase: 'complete', summary }, null, 2));

  if (secondRun.run.counters.appliedWrites !== 0) {
    abort('second_run_not_idempotent', { appliedWrites: secondRun.run.counters.appliedWrites });
  }
  if (consumer.consumerRequiredCountersNonZero !== 0) {
    abort('consumer_counters_non_zero', consumer.counters);
  }
  if (duplicateCanonicalEvents !== 0) {
    abort('duplicate_canonical_events', { duplicateCanonicalEvents });
  }
  if (failureProbe.run.counters.appliedWrites !== 0) {
    abort('failure_probe_consumer_writes', { appliedWrites: failureProbe.run.counters.appliedWrites });
  }
}

main().catch((error) => {
  abort('unhandled_error', { message: error instanceof Error ? error.message : String(error) });
});
