import { canonicalizeOfficialSourceUrl } from '../identity/source-identity';
import type { EventWritePlan } from '../types/event-candidate';
import type { VerifiedTicketCompleteResult } from '../../official-connectors/ticket-evidence/ticket-audit-metrics';
import type { SourceWriteScope } from '../../official-connectors/source-operational-config';

export type TicketResultBlockReason =
  | 'missing_or_duplicate_event_plan'
  | 'event_plan_needs_review'
  | 'event_apply_failed'
  | 'not_bound_to_existing_source';

export interface FilteredTicketResults {
  eligible: VerifiedTicketCompleteResult[];
  blocked: Array<{ sourceEventKey: string; reason: TicketResultBlockReason }>;
}

function sourcePair(key: string, url: string): string | null {
  try {
    return `${key}\n${canonicalizeOfficialSourceUrl(url)}`;
  } catch {
    return null;
  }
}

/**
 * An existing-only connector must not update ticket rows for an event
 * whose official source binding is missing, ambiguous, rejected, or failed.
 *
 * Ticket-only updates remain possible when the event-core write is a noop:
 * that is the normal path for a verified new ticket price on an unchanged event.
 * This is a second guard; the ticket persistence planner still validates price,
 * source identity, action/status and provenance independently.
 */
export function filterTicketResultsForExistingOnlyConnector(
  results: VerifiedTicketCompleteResult[],
  plans: EventWritePlan[],
  writeScope: SourceWriteScope | undefined,
  failedSourceKeys: ReadonlySet<string> = new Set(),
): FilteredTicketResults {
  if (writeScope !== 'existing_only') {
    return { eligible: results, blocked: [] };
  }

  const planBySource = new Map<string, EventWritePlan[]>();
  for (const plan of plans) {
    const pair = sourcePair(plan.sourceIdentity.sourceEventKey, plan.sourceIdentity.sourceUrl);
    if (!pair) continue;
    const matching = planBySource.get(pair) ?? [];
    matching.push(plan);
    planBySource.set(pair, matching);
  }

  const eligible: VerifiedTicketCompleteResult[] = [];
  const blocked: FilteredTicketResults['blocked'] = [];
  for (const result of results) {
    const pair = sourcePair(result.sourceEventKey, result.officialUrl);
    const matching = pair ? planBySource.get(pair) : undefined;
    if (!matching || matching.length !== 1) {
      blocked.push({ sourceEventKey: result.sourceEventKey, reason: 'missing_or_duplicate_event_plan' });
      continue;
    }
    const plan = matching[0]!;
    if (plan.validation.decision !== 'persist_ready' ||
        plan.reconciliation?.reviewRequired ||
        plan.identity?.decision === 'review_required' ||
        plan.identity?.decision === 'possible_match') {
      blocked.push({ sourceEventKey: result.sourceEventKey, reason: 'event_plan_needs_review' });
      continue;
    }
    if (failedSourceKeys.has(result.sourceEventKey)) {
      blocked.push({ sourceEventKey: result.sourceEventKey, reason: 'event_apply_failed' });
      continue;
    }

    const source = plan.existingSource;
    const boundPair = source ? sourcePair(result.sourceEventKey, source.sourceUrl) : null;
    if (!source || !boundPair || boundPair !== pair ||
        !source.eventId || source.eventId !== plan.resolvedEventId ||
        plan.eventAction === 'insert' ||
        (source.sourceEventKey && source.sourceEventKey !== result.sourceEventKey)) {
      blocked.push({ sourceEventKey: result.sourceEventKey, reason: 'not_bound_to_existing_source' });
      continue;
    }
    eligible.push(result);
  }
  return { eligible, blocked };
}
