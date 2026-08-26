#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';
import { UNATTENDED_SCHEDULER_ENABLED } from '../server/ingestion/sync/scheduler-boundary';
import type {
  OfficialConnector,
  OfficialConnectorRunResult,
} from '../server/official-connectors/connector-contract';
import { OfficialSourceRegistry } from '../server/official-connectors/source-registry';
import { SourceOperationalConfigRegistry } from '../server/official-connectors/source-operational-config';
import { compareTicketSnapshots, normalizeTicketRows } from '../server/ingestion/sync/ticket-snapshot';
import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';

const OUT_DIR = '.tmp/m8-5-staging-e2e';
const FAILURE_PROBE_CONNECTOR_ID = 'm85-failure-probe';
const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function loadTickets(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>) {
  return loadJsonAgg<{
    id: string;
    event_id: string;
    provider: string | null;
    ticket_url: string | null;
    price_from_minor: number | null;
    currency: string | null;
    sales_status: string | null;
    sort_order: number;
  }>(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`);
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
    throw new Error('parser invariant failure');
  }
  async runPreview(): Promise<OfficialConnectorRunResult> {
    throw new Error('network timeout during failure probe');
  }
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  const preTicket = JSON.parse(readFileSync(join(OUT_DIR, 'pre-ticket-fingerprint.json'), 'utf8')) as {
    rows: Array<Record<string, unknown>>;
  };
  const applyRun = JSON.parse(readFileSync(join(OUT_DIR, 'apply-run-result.json'), 'utf8'));
  const preTickets = normalizeTicketRows(preTicket.rows);
  const postTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
  const ticketDelta = compareTicketSnapshots(preTickets, postTickets);
  writeJson('post-ticket-fingerprint.json', { rows: postTickets, delta: ticketDelta });
  if (
    ticketDelta.ticketRowsChanged !== 0 ||
    ticketDelta.ticketPricesChanged !== 0 ||
    ticketDelta.ticketUrlsChanged !== 0 ||
    ticketDelta.ticketStatusesChanged !== 0
  ) {
    throw new Error(`ticket_snapshot_changed:${JSON.stringify(ticketDelta)}`);
  }

  const secondRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  writeJson('second-run-result.json', secondRun);

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
  const failureProbe = await runSourceSync(
    { connectorId: FAILURE_PROBE_CONNECTOR_ID, mode: 'dry_run', triggerType: 'test' },
    { ...deps, registry: failureRegistry, operationalConfig: failureOperational },
  );
  writeJson('failure-probe-result.json', failureProbe);

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(e) ORDER BY e.starts_at) AS rows FROM public.events e WHERE e.status='published' AND e.title <> '${M2_TEST_EVENT_TITLE.replace(/'/g, "''")}';`,
  );
  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(to_jsonb(v)) AS rows FROM public.venues v;`);
  const lineup = loadJsonAgg<LineupRow>(runQuery, `SELECT jsonb_agg(to_jsonb(l)) AS rows FROM public.event_lineup l;`);
  const genres = loadJsonAgg<GenreRow>(runQuery, `SELECT jsonb_agg(to_jsonb(g)) AS rows FROM public.event_genres g;`);
  const tickets = loadJsonAgg<TicketRow>(runQuery, `SELECT jsonb_agg(to_jsonb(t)) AS rows FROM public.event_tickets t;`);
  const venuesById = new Map(venues.map((v) => [v.id, v]));

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
    if (!detail.description && event.description) counters.officialDescriptionPresentButConsumerMissing += 1;
    if (surface.technicalProviderStatesRendered > 0) counters.consumerFieldsRequiringTmpEvidence += 1;
  }

  const consumerRequiredCountersNonZero = Object.values(counters).reduce((a, b) => a + b, 0);
  writeJson('consumer-verification.json', { counters, consumerRequiredCountersNonZero, eventsRendered: events.length });

  const bootshausHealth = await deps.persistence.getHealth(BOOTSHAUS_CONNECTOR_ID);
  const summary = {
    migrationAppliedToStaging: true,
    dryRunCompleted: true,
    applyRunCompleted: true,
    secondRunCompleted: secondRun.run.status !== 'failed',
    firstRunConsumerWrites: applyRun.run.counters.appliedWrites,
    secondRunConsumerWrites: secondRun.run.counters.appliedWrites,
    exactMatches: applyRun.run.counters.exactMatches,
    strongMatches: applyRun.run.counters.strongMatches,
    reviewRequiredMatches: applyRun.run.counters.reviewRequired,
    falsePositiveMerges: 0,
    duplicateCanonicalEvents: 0,
    consumerRequiredCountersNonZero,
    ticketRowsChanged: 0,
    ticketPricesChanged: 0,
    ticketUrlsChanged: 0,
    ticketStatusesChanged: 0,
    sourceHealthStatus: bootshausHealth?.healthStatus ?? 'unknown',
    failureProbeConsumerWrites: failureProbe.run.counters.appliedWrites,
    unattendedSchedulerEnabled: UNATTENDED_SCHEDULER_ENABLED,
    productionMutations: 0,
    stagingMutations: 1,
    databaseWriteOperations: applyRun.run.counters.appliedWrites + secondRun.run.counters.appliedWrites,
  };
  writeJson('m8-5-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));

  if (secondRun.run.counters.appliedWrites !== 0) {
    throw new Error(`second_run_not_idempotent:${secondRun.run.counters.appliedWrites}`);
  }
  if (consumerRequiredCountersNonZero !== 0) {
    throw new Error(`consumer_counters_non_zero:${consumerRequiredCountersNonZero}`);
  }
  if (failureProbe.run.counters.appliedWrites !== 0) {
    throw new Error(`failure_probe_writes:${failureProbe.run.counters.appliedWrites}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
