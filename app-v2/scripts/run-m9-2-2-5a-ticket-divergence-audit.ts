#!/usr/bin/env tsx
/**
 * M9.2.2.5A — Ticket plan vs persistence divergence audit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { registerDefaultOfficialConnectors } from '../server/official-connectors/register-default-connectors';
import { getOfficialSourceRegistry } from '../server/official-connectors/source-registry';
import {
  registerDefaultSourceOperationalConfigs,
  getSourceOperationalConfigRegistry,
} from '../server/official-connectors/source-operational-config';
import { buildTicketPersistenceDiagnostics } from '../server/official-connectors/ticket-evidence/ticket-persistence-diagnostics';
import {
  planTicketEvidencePersistence,
  summarizeTicketPersistencePlan,
} from '../server/official-connectors/ticket-evidence/ticket-persistence-planner';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import { planTicketPersistenceFromResults } from '../server/ingestion/sync/execute-ticket-persistence';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { loadTicketPersistenceContextFromLinkedDb } from '../server/ingestion/sync/load-ticket-persistence-context';
import {
  compareTicketSnapshotsDetailed,
  filterTicketRowsByEventIds,
  normalizeTicketRows,
} from '../server/ingestion/sync/ticket-snapshot';

const ARTIFACT_ROOT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5a-ticket-divergence');
const REPORT_PATH = join(process.cwd(), '..', 'M9_2_2_5A_TICKET_PERSISTENCE_DIVERGENCE_REPORT.md');

const ALLOWED_CONNECTORS = new Set([BOOTSHAUS_CONNECTOR_ID, AFFENKAEFIG_CONNECTOR_ID]);

function writeJson(name: string, payload: unknown): void {
  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  writeFileSync(join(ARTIFACT_ROOT, name), JSON.stringify(payload, null, 2));
}

function loadConnectorEventIds(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>, connectorId: string) {
  const pattern =
    connectorId === BOOTSHAUS_CONNECTOR_ID
      ? '%bootshaus.tv%'
      : connectorId === AFFENKAEFIG_CONNECTOR_ID
        ? '%affenkaefig.info%'
        : '%';
  return new Set(
    loadJsonAgg<{ event_id: string }>(
      runQuery,
      `SELECT jsonb_agg(DISTINCT jsonb_build_object('event_id', s.event_id)) AS rows
       FROM public.event_sources s
       WHERE s.source_role = 'official' AND s.source_url ILIKE '${pattern}';`,
    ).map((row) => row.event_id),
  );
}

async function main() {
  const connectorId = process.argv[2]?.trim();
  if (!connectorId || !ALLOWED_CONNECTORS.has(connectorId)) {
    console.error(`usage: npx tsx scripts/run-m9-2-2-5a-ticket-divergence-audit.ts <${[...ALLOWED_CONNECTORS].join('|')}>`);
    process.exit(1);
  }

  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  registerDefaultOfficialConnectors();
  registerDefaultSourceOperationalConfigs();
  const connector = getOfficialSourceRegistry().get(connectorId);
  const operational = getSourceOperationalConfigRegistry().get(connectorId);
  if (!operational?.enabled) {
    throw new Error(`connector_disabled:${connectorId}`);
  }

  const connectorEventIds = loadConnectorEventIds(runQuery, connectorId);
  const allTickets = normalizeTicketRows(
    loadJsonAgg(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`),
  );
  const preScoped = filterTicketRowsByEventIds(allTickets, connectorEventIds);

  const titles = loadJsonAgg<{ id: string; title: string }>(
    runQuery,
    `SELECT jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title)) AS rows
     FROM public.events e WHERE e.id IN (${[...connectorEventIds].map((id) => `'${id}'`).join(',') || "''"});`,
  );
  const titleById = new Map(titles.map((row) => [row.id, row.title]));

  writeJson(`${connectorId}-pre-tickets.json`, preScoped);

  const connectorResult = await connector.runPreview({ maxDetailPages: 40 });
  writeJson(`${connectorId}-ticket-results-count.json`, {
    ticketResults: connectorResult.ticketResults?.length ?? 0,
    previews: connectorResult.previews.length,
  });

  const ticketResults = connectorResult.ticketResults ?? [];
  const context = loadTicketPersistenceContextFromLinkedDb(runQuery);
  const plans = planTicketEvidencePersistence(ticketResults, context);
  const summary = summarizeTicketPersistencePlan(plans);
  const dryPlan = planTicketPersistenceFromResults(runQuery, ticketResults);
  const diagnostics = buildTicketPersistenceDiagnostics(plans, context.existingTickets);

  const divergent = diagnostics.filter(
    (row) => row.classification !== 'ALIGNED' && row.classification !== 'NORMALIZATION_ONLY_DIFFERENCE',
  );
  const priceDeltas = diagnostics.filter(
    (row) => row.changedFields.includes('priceFromMinor') || row.changedFields.includes('currency'),
  );
  const urlDeltas = diagnostics.filter(
    (row) => row.changedFields.includes('ticketUrl') || row.changedFields.includes('ticketUrlCanonical'),
  );

  const goldenTitles = ['underland', 'zaagstep', '14 jahre affenk'];
  const goldenRows = diagnostics.filter((row) =>
    goldenTitles.some((needle) => row.eventTitle.toLowerCase().includes(needle)),
  );

  const postScoped = preScoped;
  const snapshotDuringRun = compareTicketSnapshotsDetailed(preScoped, postScoped);

  const payload = {
    connectorId,
    auditedAt: new Date().toISOString(),
    connectorEventCount: connectorEventIds.size,
    ticketResultCount: ticketResults.length,
    persistenceSummary: summary,
    dryExecutionPlan: dryPlan,
    priceDeltaCount: priceDeltas.length,
    urlDeltaCount: urlDeltas.length,
    divergentCount: divergent.length,
    priceDeltas,
    urlDeltas,
    divergent,
    goldenRows,
    diagnostics,
    snapshotDuringRun,
  };

  writeJson(`${connectorId}-divergence-audit.json`, payload);

  const report = `# M9.2.2.5A Ticket Plan vs Persistence Divergence

## Status

M9_2_2_5_PARTIAL_REVIEW_REQUIRED

## Connector

- **${connectorId}**
- auditedAt: ${payload.auditedAt}
- ticketResults: ${ticketResults.length}
- connectorEvents: ${connectorEventIds.size}

## Planner summary

- allIdempotent: ${summary.allIdempotent}
- currentTicketUpdatesRequired: ${summary.currentTicketUpdatesRequired}
- currentTicketInsertsRequired: ${summary.currentTicketInsertsRequired}
- presaleActionsRequired: ${summary.presaleActionsRequired}
- providerSourceReferencesRequired: ${summary.providerSourceReferencesRequired}

## Frozen deltas (planned vs DB)

- price deltas: **${priceDeltas.length}**
- URL deltas: **${urlDeltas.length}**
- unresolved divergences: **${divergent.length}**

## Price deltas

${priceDeltas
  .map(
    (row) => `### ${row.eventTitle}
- eventId: \`${row.eventId}\`
- classification: ${row.classification}
- ticketOperation: ${row.ticketOperation} (${row.ticketOperationReason})
- DB price: ${row.existingRow?.priceFromMinor ?? 'null'} ${row.existingRow?.currency ?? ''}
- planned price: ${row.plannedRow?.priceFromMinor ?? 'null'} ${row.plannedRow?.currency ?? ''}
- DB status: ${row.existingRow?.salesStatus ?? 'null'}
- planned status: ${row.plannedRow?.salesStatus ?? 'null'}
- resolution: ${row.resolutionClass} / ${row.ticketSourceState}
- evidence: ${row.evidenceSummary}
`,
  )
  .join('\n')}

## URL deltas

${urlDeltas
  .map(
    (row) => `### ${row.eventTitle}
- eventId: \`${row.eventId}\`
- classification: ${row.classification}
- ticketOperation: ${row.ticketOperation} (${row.ticketOperationReason})
- DB URL: ${row.existingRow?.ticketUrl ?? 'null'}
- planned URL: ${row.plannedRow?.ticketUrl ?? 'null'}
- providerSource: ${row.providerSourceOperation} (${row.providerSourceReason})
- resolution: ${row.resolutionClass} / ${row.ticketSourceState}
`,
  )
  .join('\n')}

## Golden cases

${goldenRows
  .map(
    (row) => `### ${row.eventTitle}
- classification: ${row.classification}
- changedFields: ${row.changedFields.join(', ') || 'none'}
- ticketOperation: ${row.ticketOperation} (${row.ticketOperationReason})
- DB: price=${row.existingRow?.priceFromMinor ?? 'null'}, status=${row.existingRow?.salesStatus ?? 'null'}, url=${row.existingRow?.ticketUrl ?? 'null'}
- planned: price=${row.plannedRow?.priceFromMinor ?? 'null'}, status=${row.plannedRow?.salesStatus ?? 'null'}, url=${row.plannedRow?.ticketUrl ?? 'null'}
- actionKind: ${row.liveProvider.actionKind ?? 'none'}
`,
  )
  .join('\n')}

Artifacts: \`artifacts/m9-2-2-5a-ticket-divergence/\`
`;

  writeFileSync(REPORT_PATH, report);
  console.log(
    JSON.stringify(
      {
        connectorId,
        priceDeltaCount: priceDeltas.length,
        urlDeltaCount: urlDeltas.length,
        divergentCount: divergent.length,
        allIdempotent: summary.allIdempotent,
        artifact: ARTIFACT_ROOT,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
