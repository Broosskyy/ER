#!/usr/bin/env tsx
/**
 * M9.0 — Controlled staging scheduled sync entry point.
 *
 * Usage (from app-v2/):
 *   npx tsx scripts/run-scheduled-staging-sync.ts bootshaus-official
 *   npx tsx scripts/run-scheduled-staging-sync.ts affenkaefig-official
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
import {
  STAGING_SCHEDULER_ENABLED,
  STAGING_SCHEDULED_CONNECTOR_IDS,
  isStagingScheduledConnectorId,
} from '../server/ingestion/sync/scheduler-boundary';
import { assertScheduledStagingApplyAllowed } from '../server/ingestion/sync/scheduler-guard';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  compareTicketSnapshots,
  compareTicketSnapshotsDetailed,
  filterTicketRowsByEventIds,
  normalizeTicketRows,
} from '../server/ingestion/sync/ticket-snapshot';

const OUT_DIR = '.tmp/m9-0-scheduled-sync';

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function abort(reason: string, extra: Record<string, unknown> = {}): never {
  const payload = { decision: 'M9_0_SCHEDULED_ABORTED', reason, ...extra };
  writeJson('abort.json', payload);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

async function main() {
  const connectorId = process.argv[2]?.trim();
  if (!connectorId || !isStagingScheduledConnectorId(connectorId)) {
    abort('invalid_connector_id', {
      connectorId,
      allowed: STAGING_SCHEDULED_CONNECTOR_IDS,
    });
  }

  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const stagingTarget = verifyLinkedStagingTarget(cwd);

  if (!STAGING_SCHEDULER_ENABLED) {
    abort('global_scheduler_disabled');
  }

  assertScheduledStagingApplyAllowed({
    connectorId,
    mode: 'apply',
    triggerType: 'scheduled',
    linkedProjectRef: stagingTarget.ref,
  });

  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const connectorEventIds = new Set(
    loadJsonAgg<{ event_id: string }>(
      runQuery,
      `SELECT jsonb_agg(DISTINCT jsonb_build_object('event_id', s.event_id)) AS rows
       FROM public.event_sources s
       WHERE s.source_role = 'official'
         AND (
           (s.source_url ILIKE '%bootshaus.tv%' AND '${connectorId}' = 'bootshaus-official')
           OR (s.source_url ILIKE '%affenkaefig.info%' AND '${connectorId}' = 'affenkaefig-official')
         );`,
    ).map((row) => row.event_id),
  );

  const preTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
  const preScopedTickets = filterTicketRowsByEventIds(preTickets, connectorEventIds);

  writeJson('preflight.json', {
    branch: 'rebuild/event-core-clean',
    connectorId,
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
    linkedProject: stagingTarget,
    triggerType: 'scheduled',
    mode: 'apply',
    stagingSchedulerEnabled: STAGING_SCHEDULER_ENABLED,
  });

  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });
  const result = await runSourceSync(
    { connectorId, mode: 'apply', triggerType: 'scheduled' },
    deps,
  );

  const postTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
  const postScopedTickets = filterTicketRowsByEventIds(postTickets, connectorEventIds);
  const ticketDelta = compareTicketSnapshots(preTickets, postTickets);
  const connectorTicketDelta = compareTicketSnapshotsDetailed(preScopedTickets, postScopedTickets);

  const healthRow = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(h)) AS rows FROM public.ingestion_source_health h WHERE h.connector_id = '${connectorId}';`,
  )[0];

  const summary = {
    connectorId,
    runId: result.run.runId,
    status: result.run.status,
    triggerType: result.run.triggerType,
    counters: result.run.counters,
    errorCategories: result.run.errorCategories,
    healthStatus: result.health.healthStatus,
    contentReviewCount: result.health.contentReviewCount ?? 0,
    appliedWrites: result.run.counters.appliedWrites,
    reviewRequired: result.run.counters.reviewRequired,
    ticketDelta,
    connectorTicketDelta,
    realSnapshotDeltas: {
      price: connectorTicketDelta.ticketPricesChanged,
      url: connectorTicketDelta.semanticUrlDeltas,
      status: connectorTicketDelta.ticketStatusesChanged,
      inserted: connectorTicketDelta.inserted,
      updated: connectorTicketDelta.updated,
      deleted: connectorTicketDelta.deleted,
    },
    ticketPersistence: result.ticketPersistence ?? null,
    persistedHealth: healthRow,
  };

  writeJson(`${connectorId}-scheduled-result.json`, { result, summary });

  if (result.run.triggerType !== 'scheduled') {
    abort('trigger_type_mismatch', { triggerType: result.run.triggerType });
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main();
