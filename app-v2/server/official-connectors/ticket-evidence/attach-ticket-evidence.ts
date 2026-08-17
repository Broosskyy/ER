import type { EventCandidateTicket } from '../../ingestion/types/event-candidate';
import type { EventTicketEvidence } from './types';
import { lowestAdmissionOffer } from './ticket-io-evidence-provider';

export function ticketEvidenceToCandidateTickets(evidence: EventTicketEvidence): EventCandidateTicket[] {
  const lowest = lowestAdmissionOffer(evidence);
  return [
    {
      provider: evidence.providerKey,
      ticketUrl: evidence.canonicalTicketUrl,
      priceFromMinor: lowest?.amountMinor,
      currency: lowest?.currency,
      salesStatus: evidence.normalizedStatus,
      sortOrder: 0,
    },
  ];
}

export function buildTicketSourcePayload(evidence: EventTicketEvidence): Record<string, unknown> {
  return {
    providerKey: evidence.providerKey,
    providerIdentity: evidence.providerIdentity,
    canonicalTicketUrl: evidence.canonicalTicketUrl,
    sourceUrl: evidence.sourceUrl,
    contentFingerprint: evidence.contentFingerprint,
    sourceObservedAt: evidence.sourceObservedAt,
    extractedAt: evidence.extractedAt,
    normalizedStatus: evidence.normalizedStatus,
    statusLabel: evidence.statusLabel,
    offers: evidence.offers,
    rejectedOffers: evidence.rejectedOffers,
    confidence: evidence.confidence,
    eventIdentityEvidence: evidence.eventIdentityEvidence,
  };
}
