import {
  buildTicketPersistenceApplySql,
  countPlannedTicketMutations,
} from '../../official-connectors/ticket-evidence/ticket-persistence-apply';
import {
  planTicketEvidencePersistence,
  summarizeTicketPersistencePlan,
} from '../../official-connectors/ticket-evidence/ticket-persistence-planner';
import type { VerifiedTicketCompleteResult } from '../../official-connectors/ticket-evidence/ticket-audit-metrics';
import type { LinkedQueryExecutor } from './linked-db';
import { loadTicketPersistenceContextFromLinkedDb } from './load-ticket-persistence-context';

export interface TicketPersistenceExecutionResult {
  applied: boolean;
  inserts: number;
  updates: number;
  deletes: number;
  ticketRowsChanged: number;
  allIdempotent: boolean;
}

export function planTicketPersistenceFromResults(
  runQuery: LinkedQueryExecutor,
  results: VerifiedTicketCompleteResult[],
) {
  const context = loadTicketPersistenceContextFromLinkedDb(runQuery);
  const plans = planTicketEvidencePersistence(results, context);
  return summarizeTicketPersistencePlan(plans);
}

export function executeTicketPersistenceFromResults(
  runQuery: LinkedQueryExecutor,
  results: VerifiedTicketCompleteResult[],
): TicketPersistenceExecutionResult {
  const summary = planTicketPersistenceFromResults(runQuery, results);
  if (summary.allIdempotent) {
    return {
      applied: false,
      inserts: 0,
      updates: 0,
      deletes: 0,
      ticketRowsChanged: 0,
      allIdempotent: true,
    };
  }

  const precheck = runQuery(`
    SELECT jsonb_build_object(
      'events', (SELECT COUNT(*)::int FROM public.events),
      'eventTickets', (SELECT COUNT(*)::int FROM public.event_tickets),
      'eventSources', (SELECT COUNT(*)::int FROM public.event_sources)
    ) AS rows;
  `) as { events: number; eventTickets: number; eventSources: number };

  const mutationCounts = countPlannedTicketMutations(summary);
  const postcheckTickets =
    precheck.eventTickets + mutationCounts.inserts - mutationCounts.deletes;
  const sql = buildTicketPersistenceApplySql(summary, precheck, postcheckTickets);
  runQuery(sql);

  const ticketRowsChanged = mutationCounts.inserts + mutationCounts.updates + mutationCounts.deletes;

  return {
    applied: ticketRowsChanged > 0 || summary.provenanceUpdatesRequired > 0 || summary.providerSourceReferencesRequired > 0,
    inserts: mutationCounts.inserts,
    updates: mutationCounts.updates,
    deletes: mutationCounts.deletes,
    ticketRowsChanged,
    allIdempotent: false,
  };
}
