#!/usr/bin/env tsx
/**
 * M8.6 — Second Source Expansion (Affenkäfig) on staging only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
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
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  compareTicketSnapshots,
  normalizeTicketRows,
} from '../server/ingestion/sync/ticket-snapshot';

const OUT_DIR = '.tmp/m8-6-affenkaefig-e2e';

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function abort(reason: string, extra: Record<string, unknown> = {}): never {
  const payload = { decision: 'M8_6_ABORTED', reason, ...extra };
  writeJson('abort.json', payload);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  if (UNATTENDED_SCHEDULER_ENABLED) {
    abort('scheduler_must_remain_disabled');
  }

  writeJson('preflight.json', {
    branch: 'rebuild/event-core-clean',
    remoteHead: '9d7ce6c',
    target: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
    sourcesRegistered: deps.registry.listConnectorIds().sort(),
  });

  const preSnapshot = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
  );
  writeJson('pre-ticket-fingerprint.json', { rows: normalizeTicketRows(preSnapshot) });
  writeJson('pre-apply-snapshot.json', {
    counts: runQuery(`
      SELECT jsonb_build_object(
        'events', (SELECT COUNT(*)::int FROM public.events),
        'event_sources', (SELECT COUNT(*)::int FROM public.event_sources),
        'event_lineup', (SELECT COUNT(*)::int FROM public.event_lineup),
        'event_genres', (SELECT COUNT(*)::int FROM public.event_genres),
        'event_tickets', (SELECT COUNT(*)::int FROM public.event_tickets)
      ) AS rows;
    `),
  });

  const dryRun = await runSourceSync(
    { connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'dry_run', triggerType: 'manual' },
    deps,
  );
  writeJson('dry-run-result.json', dryRun);

  if (dryRun.run.counters.appliedWrites !== 0) {
    abort('dry_run_must_not_write', { appliedWrites: dryRun.run.counters.appliedWrites });
  }
  if (dryRun.run.counters.parsed === 0) {
    abort('unexpected_zero_results', { counters: dryRun.run.counters });
  }
  if (dryRun.run.errorCategories.includes('unexpected_zero_results')) {
    abort('zero_result_anomaly');
  }

  const applyRun = await runSourceSync(
    { connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  writeJson('apply-run-result.json', applyRun);

  const postTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
  const preTickets = normalizeTicketRows(preSnapshot);
  const ticketDelta = compareTicketSnapshots(preTickets, postTickets);
  writeJson('post-ticket-fingerprint.json', { rows: postTickets, delta: ticketDelta });

  if (
    ticketDelta.ticketRowsChanged !== 0 ||
    ticketDelta.ticketPricesChanged !== 0 ||
    ticketDelta.ticketUrlsChanged !== 0 ||
    ticketDelta.ticketStatusesChanged !== 0
  ) {
    abort('ticket_freeze_violation', ticketDelta);
  }

  const secondRun = await runSourceSync(
    { connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  writeJson('second-run-result.json', secondRun);

  const bootshausDryRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'dry_run', triggerType: 'manual' },
    deps,
  );
  writeJson('bootshaus-regression-dry-run.json', bootshausDryRun);

  const summary = {
    affenkaefigEventsDiscovered: dryRun.run.counters.discovered,
    affenkaefigEventsParsed: dryRun.run.counters.parsed,
    affenkaefigEventsRejected: dryRun.run.counters.rejected,
    firstRunConsumerWrites: applyRun.run.counters.appliedWrites,
    secondRunConsumerWrites: secondRun.run.counters.appliedWrites,
    exactMatches: applyRun.run.counters.exactMatches,
    strongMatches: applyRun.run.counters.strongMatches,
    reviewRequiredMatches: applyRun.run.counters.reviewRequired,
    newEvents: applyRun.run.counters.newEvents,
    bootshausDryRunAppliedWrites: bootshausDryRun.run.counters.appliedWrites,
    sourceHealthStatus: applyRun.health?.healthStatus,
    productionMutations: 0,
    unattendedSchedulerEnabled: UNATTENDED_SCHEDULER_ENABLED,
  };
  writeJson('m8-6-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));

  if (secondRun.run.counters.appliedWrites !== 0) {
    process.exit(1);
  }
  if (bootshausDryRun.run.counters.appliedWrites !== 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
