import { matchEventToCatalog } from '../../ingestion/identity/event-matcher';
import type { EventMatchCatalogEntry } from '../../ingestion/identity/event-match-types';
import { canonicalTicketUrlForCompare } from '../../../shared/match-normalizers';
import type { EternalRaveMatchClassification } from '../ticket-evidence/network-discovery/types';
import type { RausgegangenDiscoveryCandidate } from './types';

function mapDecisionToClassification(
  decision: string,
  ticketUrlMatch: boolean,
): EternalRaveMatchClassification {
  if (ticketUrlMatch && (decision === 'exact_match' || decision === 'strong_match')) {
    return 'EXISTING_EXACT';
  }
  if (decision === 'exact_match') {
    return 'EXISTING_EXACT';
  }
  if (decision === 'strong_match') {
    return 'EXISTING_STRONG_MATCH';
  }
  if (decision === 'possible_match' || decision === 'review_required') {
    return 'POSSIBLE_MATCH';
  }
  return 'NET_NEW';
}

export function matchRausgegangenCandidateAgainstCatalog(
  candidate: RausgegangenDiscoveryCandidate,
  catalog: EventMatchCatalogEntry[],
): RausgegangenDiscoveryCandidate {
  const matchInput = {
    title: candidate.title,
    startsAt: candidate.startsAt ?? '1970-01-01T00:00:00Z',
    endsAt: candidate.endsAt,
    timezone: 'Europe/Berlin',
    venueName: candidate.venueName,
    venueCity: candidate.city,
    organizerName: candidate.organizerName,
    lineupBillingNames: candidate.lineupHints,
    sourceUrl: candidate.canonicalUrl,
    sourceEventKey: candidate.identityKey,
    connectorId: 'rausgegangen-discovery',
  };

  const result = matchEventToCatalog(matchInput, catalog);
  const ticketUrlMatch = catalog.some((entry) =>
    entry.sourceBindings.some(
      (binding) =>
        binding.sourceUrl &&
        candidate.ticketUrl &&
        canonicalTicketUrlForCompare(binding.sourceUrl) === canonicalTicketUrlForCompare(candidate.ticketUrl),
    ),
  );

  const classification = mapDecisionToClassification(result.decision, ticketUrlMatch);

  return {
    ...candidate,
    matchClassification:
      classification === 'NET_NEW' && result.decision === 'review_required'
        ? 'REVIEW_REQUIRED'
        : classification,
    matchedEventId: result.candidateEventId,
    matchedEventTitle: result.candidateEventId
      ? catalog.find((entry) => entry.eventId === result.candidateEventId)?.title
      : undefined,
    matchReasons: [...result.reasons, `decision:${result.decision}`, ticketUrlMatch ? 'ticket_url_binding_match' : 'no_ticket_url_binding'],
  };
}
