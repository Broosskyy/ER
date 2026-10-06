import { matchEventToCatalog } from '../../../ingestion/identity/event-matcher';
import type { EventMatchCatalogEntry } from '../../../ingestion/identity/event-match-types';
import { canonicalTicketUrlForCompare } from '../../../../shared/match-normalizers';
import type { TicketIoEventDiscoveryCandidate, EternalRaveMatchClassification } from './types';

export interface StagingCatalogEvent {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string;
  venueCity?: string;
  organizerName?: string;
  ticketUrl?: string | null;
  officialUrl?: string | null;
  lineupBillingNames: string[];
}

export function buildMatchCatalogFromStaging(events: StagingCatalogEvent[]): EventMatchCatalogEntry[] {
  return events.map((event) => ({
    eventId: event.eventId,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: 'Europe/Berlin',
    venueName: event.venueName,
    venueCity: event.venueCity,
    organizerName: event.organizerName,
    lineupBillingNames: event.lineupBillingNames,
    sourceBindings: [
      ...(event.ticketUrl
        ? [
            {
              sourceId: `${event.eventId}:ticket`,
              eventId: event.eventId,
              sourceRole: 'ticket',
              sourceUrl: event.ticketUrl,
            },
          ]
        : []),
      ...(event.officialUrl
        ? [
            {
              sourceId: `${event.eventId}:official`,
              eventId: event.eventId,
              sourceRole: 'official',
              sourceUrl: event.officialUrl,
            },
          ]
        : []),
    ],
  }));
}

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

export function matchDiscoveryCandidateAgainstCatalog(
  candidate: TicketIoEventDiscoveryCandidate,
  catalog: EventMatchCatalogEntry[],
): TicketIoEventDiscoveryCandidate {
  const matchInput = {
    title: candidate.title,
    startsAt: candidate.startsAt ?? '1970-01-01T00:00:00Z',
    endsAt: candidate.endsAt,
    timezone: 'Europe/Berlin',
    venueName: candidate.venueName,
    venueCity: candidate.city,
    organizerName: candidate.organizerName,
    lineupBillingNames: candidate.lineupHints,
    sourceUrl: candidate.ticketUrl,
    sourceEventKey: candidate.identityKey,
    connectorId: 'ticket-io-network-discovery',
  };

  const result = matchEventToCatalog(matchInput, catalog);

  const ticketUrlMatch = catalog.some((entry) =>
    entry.sourceBindings.some(
      (binding) =>
        binding.sourceUrl &&
        canonicalTicketUrlForCompare(binding.sourceUrl) ===
          canonicalTicketUrlForCompare(candidate.ticketUrl),
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

export function isGoldenAnchorMatch(
  candidate: TicketIoEventDiscoveryCandidate,
  anchorTitlePattern: RegExp,
): boolean {
  return anchorTitlePattern.test(candidate.title);
}
