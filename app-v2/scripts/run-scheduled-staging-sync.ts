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
import {
  STAGING_PROJECT_REF,
  getConfiguredProductionProjectRef,
} from '../server/ingestion/sync/staging-guard';
import { evaluateDailyOfficialSyncPreflight } from '../server/ingestion/sync/daily-sync-preflight';
import { selectDailySafeBatch } from '../server/ingestion/sync/daily-safe-batch';
import { planTicketPersistenceFromResults } from '../server/ingestion/sync/execute-ticket-persistence';
import { getDailySourcePolicy } from '../server/ingestion/sync/daily-source-policies';
import { pickScheduledRausgegangenSourceUrls } from '../server/ingestion/sync/daily-rausgegangen-scope';
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

  const policy = getDailySourcePolicy(connectorId);
  if (!policy) abort('unregistered_daily_source_policy', {connectorId});
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const stagingTarget = verifyLinkedStagingTarget(cwd);

  if (!STAGING_SCHEDULER_ENABLED) {
    abort('daily_sync_disabled_or_public_db_not_acknowledged');
  }
  if (process.env.ETERNAL_RAVE_PUBLIC_DB_SYNC_ACKNOWLEDGED !== 'true') {
    abort('public_database_write_not_acknowledged');
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
           OR (s.source_url ILIKE '%rausgegangen.de/events/%' AND '${connectorId}' = 'rausgegangen-discovery')
           OR (s.source_url ILIKE '%zakk.de/event-detail%' AND '${connectorId}' = 'zakk-official')
           OR (s.source_url ILIKE '%stadtgarten.de/programm/%' AND '${connectorId}' = 'stadtgarten-official')
           OR (s.source_url ILIKE '%odonien.de/veranstaltungen/%' AND '${connectorId}' = 'odonien-club-official')
           OR (s.source_url ILIKE 'https://tresorberlin.com/event/%' AND '${connectorId}' = 'tresor-berlin-official')
           OR (s.source_url ~* '^https://(area51events|electric-horizon|techno-rave|lieberscholli|capitolpaderborn|sheg-events|s-club-fulda)[.]ticket[.]io/[a-z0-9]{8}/' AND '${connectorId}' = 'ticketio-organizer-discovery')
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
    production: getConfiguredProductionProjectRef() ?? null,
    linkedProject: stagingTarget,
    triggerType: 'scheduled',
    mode: 'apply',
    stagingSchedulerEnabled: STAGING_SCHEDULER_ENABLED,
  });

  const preferredSourceUrls = connectorId === 'rausgegangen-discovery'
    ? pickScheduledRausgegangenSourceUrls(loadJsonAgg<{source_url: string}>(
        runQuery,
        `SELECT COALESCE(jsonb_agg(jsonb_build_object('source_url',s.source_url)
          ORDER BY e.starts_at), '[]'::jsonb) AS rows
         FROM public.event_sources s JOIN public.events e ON e.id=s.event_id
         WHERE s.source_role='official'
           AND s.source_url ~* '^https://(www[.])?rausgegangen[.]de/events/'
           AND e.status='published' AND e.published_at IS NOT NULL
           AND COALESCE(e.ends_at,e.starts_at+interval '18 hours')>now();`,
      ).map(entry => entry.source_url), Math.floor(Date.now()/86400000), 10)
    : [];
  // Already-bound source URLs are excluded from the NEW-event discovery
  // slots; the rotating preferred subset above continues checking existing
  // event prices, ticket URLs and sales statuses.
  const knownSourceUrls = connectorId === 'rausgegangen-discovery'
    ? loadJsonAgg<{source_url: string}>(runQuery,
        `SELECT COALESCE(jsonb_agg(jsonb_build_object('source_url',source_url)),
          '[]'::jsonb) AS rows FROM public.event_sources
         WHERE source_role='official'
           AND source_url ~* '^https://(www[.])?rausgegangen[.]de/events/';`)
        .map(row => row.source_url)
    : [];
  const discoverySlot = Math.floor(Date.now() / 21_600_000);
  writeJson(`${connectorId}-daily-source-scope.json`, {
    connectorId, reviewedExistingSourceCount: preferredSourceUrls.length,
    knownBindings: knownSourceUrls.length, discoverySlot,
    sourceUrls: preferredSourceUrls,
  });

  const deps = createStagingSyncDependencies({
    cwd, runQuery, verifyTarget: false,
    rausgegangenOptions: {
      preferredEventUrls: preferredSourceUrls,
      knownEventUrls: knownSourceUrls,
      selectionSlot: discoverySlot,
    },
  });

  // Prioritize net-new discovery while preserving ten rotating existing-source checks.
  // Always plan first. Do NOT apply any source changes when source parsing,
  // identity or unusually large write counts look unhealthy.
  const preview = await runSourceSync(
    { connectorId, mode: 'dry_run', triggerType: 'scheduled', maxDetailPages: policy.maxDetailPages },
    deps,
  );
  writeJson(`${connectorId}-daily-preflight.json`, preview);
  // zakk is a multi-genre venue; a successful listing with no currently
  // qualifying electronic parties is a review-only no-op, not permission
  // to publish non-electronic parties to make a daily job pass.
  if (['zakk-official','stadtgarten-official'].includes(connectorId) &&
      preview.run.counters.discovered > 0 &&
      preview.run.counters.fetched > 0 &&
      preview.run.counters.parsed === 0 &&
      preview.run.counters.failures === 0 &&
      preview.run.errorCategories.every(category => category === 'unexpected_zero_results')) {
    writeJson(`${connectorId}-scheduled-result.json`, {
      connectorId, status:'no_qualifying_electronic_events_review_only',
      reviewRequired:true, databaseWrites:0,
      preflight:preview.run, sourceReview:'Check source calendar and electronic relevance',
    });
    return;
  }
  const minimumParsed = policy.minimumParsed;
  const safeBatch = selectDailySafeBatch(preview, {
    newEvents: policy.maxNewEvents, existingUpdates: policy.maxExistingUpdates,
  }, { existingOnly: policy.writeScope === 'existing_only' });
  writeJson(`${connectorId}-selected-safe-batch.json`, {
    ...safeBatch,
    bindings: Array.from(safeBatch.bindings.entries()),
  });
  const gate = evaluateDailyOfficialSyncPreflight(preview, minimumParsed, safeBatch);
  if (!gate.allowed &&
      !(policy.writeScope === 'existing_only' &&
        safeBatch.bindings.size === 0 &&
        gate.reasons.length === 1 &&
        gate.reasons[0] === 'no_safe_candidates_to_apply')) {
    abort('daily_preflight_rejected', {
      connectorId, reasons: gate.reasons, counters: preview.run.counters,
      runStatus: preview.run.status, errorCategories: preview.run.errorCategories,
      safeBatch: { ...safeBatch, bindings: Array.from(safeBatch.bindings.entries()) },
    });
  }

  // A dry-run must not silently mutate ticket rows. Fail closed if it does.
  const ticketsAfterPreview = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      'SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;',
    ),
  );
  if (compareTicketSnapshots(preTickets, ticketsAfterPreview).ticketRowsChanged > 0) {
    abort('daily_preflight_mutated_tickets');
  }

  if (policy.writeScope === 'existing_only' && safeBatch.bindings.size === 0) {
    writeJson(`${connectorId}-scheduled-result.json`, {
      status: 'review_only_no_existing_bindings',
      selectedSafeBatch: {...safeBatch, bindings: []},
      preflight: preview.run,
      databaseWrites: 0,
    });
    console.log(JSON.stringify({
      connectorId, status: 'review_only_no_existing_bindings',
      parsed: preview.run.counters.parsed, databaseWrites: 0,
    }));
    return;
  }

  // Only exact key/URL pairs from this preview can write in the apply pass.
  deps.scheduledApplyBindings = safeBatch.bindings;
  const unguardedTicketApply = deps.applyTicketResults;
  if (!unguardedTicketApply) abort('daily_ticket_executor_missing');
  deps.applyTicketResults = async (ticketEvidence, mode) => {
    if (mode === 'apply') {
      const planned = planTicketPersistenceFromResults(runQuery, ticketEvidence);
      const requestedWrites = planned.currentTicketInsertsRequired +
        planned.currentTicketUpdatesRequired + planned.currentTicketDeletesRequired;
      if (planned.currentTicketDeletesRequired > 0 || requestedWrites > policy.maxTicketChanges) {
        abort('daily_ticket_changes_exceed_safe_limits', {
          inserts: planned.currentTicketInsertsRequired,
          updates: planned.currentTicketUpdatesRequired,
          deletes: planned.currentTicketDeletesRequired,
        });
      }
    }
    return unguardedTicketApply(ticketEvidence, mode);
  };
  const result = await runSourceSync(
    { connectorId, mode: 'apply', triggerType: 'scheduled', maxDetailPages: policy.maxDetailPages },
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
    previewCounters: preview.run.counters,
    selectedSafeBatch: { ...safeBatch, bindings: Array.from(safeBatch.bindings.entries()) },
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
  if (result.run.status === 'failed' || result.run.status === 'cancelled' ||
      result.run.counters.parsed < minimumParsed ||
      result.run.counters.failures > 0) {
    abort('daily_apply_unhealthy', { summary });
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main();
