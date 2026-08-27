#!/usr/bin/env tsx
/**
 * M9.2 — Affenkäfig staging gate (allows ticket recovery writes).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  compareTicketSnapshots,
  normalizeTicketRows,
} from '../server/ingestion/sync/ticket-snapshot';

const connectorId = 'affenkaefig-official';
const OUT_DIR = '.tmp/m9-2-affenkaefig-gate';

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  const preTickets = normalizeTicketRows(
    loadJsonAgg(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`),
  );

  const dryRun = await runSourceSync({ connectorId, mode: 'dry_run', triggerType: 'manual' }, deps);
  writeJson('dry-run.json', dryRun);

  const applyRun = await runSourceSync({ connectorId, mode: 'apply', triggerType: 'manual' }, deps);
  writeJson('apply-run.json', applyRun);

  const postApplyTickets = normalizeTicketRows(
    loadJsonAgg(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`),
  );
  const firstTicketDelta = compareTicketSnapshots(preTickets, postApplyTickets);

  const secondRun = await runSourceSync({ connectorId, mode: 'apply', triggerType: 'manual' }, deps);
  writeJson('second-run.json', secondRun);

  const postSecondTickets = normalizeTicketRows(
    loadJsonAgg(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`),
  );
  const secondTicketDelta = compareTicketSnapshots(postApplyTickets, postSecondTickets);

  const bootshausDryRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'dry_run', triggerType: 'manual' },
    deps,
  );

  const summary = {
    connectorId,
    discovered: dryRun.run.counters.discovered,
    parsed: dryRun.run.counters.parsed,
    firstRunConsumerWrites: applyRun.run.counters.appliedWrites,
    secondRunConsumerWrites: secondRun.run.counters.appliedWrites,
    firstTicketDelta,
    secondTicketDelta,
    bootshausDryRunAppliedWrites: bootshausDryRun.run.counters.appliedWrites,
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
  };
  writeJson('gate-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));

  if (secondRun.run.counters.appliedWrites !== 0) {
    process.exit(1);
  }
  if (secondTicketDelta.ticketRowsChanged !== 0) {
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
