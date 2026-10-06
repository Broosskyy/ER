#!/usr/bin/env tsx
import { AffenkaefigOfficialConnector } from '../server/official-connectors/affenkaefig/affenkaefig-official-connector';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { planTicketPersistenceFromResults } from '../server/ingestion/sync/execute-ticket-persistence';

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const connector = new AffenkaefigOfficialConnector();
  const result = await connector.runPreview({ maxDetailPages: 40 });
  const underland = result.ticketResults?.find((r) => r.sourceEventKey.includes('underland'));
  console.log(
    JSON.stringify(
      {
        ticketResultCount: result.ticketResults?.length ?? 0,
        underland: underland
          ? {
              identityResult: underland.identityResult,
              classification: underland.classification,
              canonicalTicketUrl: underland.canonicalTicketUrl,
              offerCount: underland.ticketEvidence?.offers?.length ?? 0,
              firstOffer: underland.ticketEvidence?.offers?.[0],
              normalizedStatus: underland.ticketEvidence?.normalizedStatus,
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (result.ticketResults?.length) {
    const planned = planTicketPersistenceFromResults(runQuery, result.ticketResults);
    console.log(
      JSON.stringify(
        {
          inserts: planned.currentTicketInsertsRequired,
          updates: planned.currentTicketUpdatesRequired,
          deletes: planned.currentTicketDeletesRequired,
          allIdempotent: planned.allIdempotent,
          eventPlans: planned.eventPlans.map((plan) => ({
            sourceEventKey: plan.sourceEventKey,
            ticketOperation: plan.ticketOperation,
            ticketOperationReason: plan.ticketOperationReason,
            ticketSourceState: plan.ticketSourceState,
            priceFromMinor: plan.plannedTicketRow?.priceFromMinor,
            ticketUrl: plan.plannedTicketRow?.ticketUrl,
          })),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
