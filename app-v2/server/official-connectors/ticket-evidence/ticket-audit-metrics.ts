import type {
  DiscoveredTicketLink,
  EventTicketEvidence,
  TicketAuditCounters,
  TicketIdentityResult,
  TicketProviderEventEvidence,
} from './types';
import { createEmptyTicketAuditCounters } from './types';
import { isAdmissionOfferRole } from './ticket-offer-role';
import { isMerchandiseUrl } from './url-policy';
import { lowestAdmissionOffer } from './ticket-io-evidence-provider';

export interface VerifiedTicketCompleteResult {
  sourceEventKey: string;
  officialUrl: string;
  title: string;
  startsAt: string;
  venueName?: string;
  discoveredLinks: DiscoveredTicketLink[];
  rejectedCandidates: Array<{ url: string; reason: string }>;
  primaryLink?: DiscoveredTicketLink;
  canonicalTicketUrl?: string;
  providerKey?: string;
  providerEvidence?: TicketProviderEventEvidence;
  ticketEvidence?: EventTicketEvidence;
  identityResult: TicketIdentityResult;
  identityReasons: string[];
  classification: string;
  verifiedTicketComplete: boolean;
  resolvedAction?: import('./types').ResolvedTicketAction;
  priceEvidence?: import('./types').TicketPriceEvidence;
  ticketSourceStateEvidence?: import('./types').TicketSourceStateEvidence;
  statusProjection?: {
    availabilityStatus: import('./types').TicketAvailabilityStatus;
    normalizedStatus: string;
    statusLabel: string;
    statusEvidenceOrigin: import('./types').TicketStatusEvidenceOrigin;
  };
  resolutionClass?: import('./types').TicketEventResolutionClass;
  consumerPreview?: {
    title: string;
    startsAt: string;
    venueName?: string;
    providerKey?: string;
    visiblePrice?: string;
    priceFromMinor?: number;
    currency?: string;
    status?: string;
    badge?: string;
    canonicalTicketUrl?: string;
    admissionOfferCount?: number;
    rejectedAddonCount?: number;
    evidenceOrigin?: string;
    identityResult: TicketIdentityResult;
    priceLabel?: string;
    priceEvidenceState?: string;
    actionKind?: string;
    actionLabel?: string;
    evidenceObservedAt?: string;
    statusEvidenceOrigin?: string;
  };
}

export function isVerifiedTicketComplete(result: VerifiedTicketCompleteResult): boolean {
  if (!result.primaryLink) return false;
  if (!result.canonicalTicketUrl) return false;
  if (isMerchandiseUrl(result.canonicalTicketUrl)) return false;
  if (result.identityResult !== 'ticket_identity_verified') return false;
  if (!result.ticketEvidence) return false;
  if (!result.providerEvidence) return false;

  const lowest = lowestAdmissionOffer(result.ticketEvidence);
  const admissionOffers = result.ticketEvidence.offers.filter((o) =>
    isAdmissionOfferRole(o.role ?? 'unknown_addon'),
  );

  return (
    admissionOffers.length > 0 &&
    lowest?.amountMinor !== undefined &&
    lowest.currency !== undefined &&
    result.ticketEvidence.normalizedStatus !== undefined &&
    result.ticketEvidence.statusLabel !== undefined &&
    result.ticketEvidence.contentFingerprint.length > 0 &&
    result.ticketEvidence.sourceObservedAt.length > 0
  );
}

export interface TicketCoverageMetrics {
  eventsAudited: number;
  eventsWithTicketButtonOrLink: number;
  correctTicketLinksResolved: number;
  merchandiseLinksPublishedAsTickets: number;
  providerIdentitiesVerified: number;
  eventsWithAdmissionOffer: number;
  eventsWithVerifiedPrice: number;
  eventsWithVerifiedStatus: number;
  eventsWithStatusBadge: number;
  eventsWithCanonicalTicketUrl: number;
  verifiedTicketComplete: number;
  linkedEventsWithoutTicketRow: number;
}

export function computeCoverageMetrics(results: VerifiedTicketCompleteResult[]): TicketCoverageMetrics {
  const metrics: TicketCoverageMetrics = {
    eventsAudited: results.length,
    eventsWithTicketButtonOrLink: 0,
    correctTicketLinksResolved: 0,
    merchandiseLinksPublishedAsTickets: 0,
    providerIdentitiesVerified: 0,
    eventsWithAdmissionOffer: 0,
    eventsWithVerifiedPrice: 0,
    eventsWithVerifiedStatus: 0,
    eventsWithStatusBadge: 0,
    eventsWithCanonicalTicketUrl: 0,
    verifiedTicketComplete: 0,
    linkedEventsWithoutTicketRow: 0,
  };

  for (const result of results) {
    if (result.discoveredLinks.length > 0) {
      metrics.eventsWithTicketButtonOrLink += 1;
    }
    if (result.primaryLink && result.canonicalTicketUrl && !isMerchandiseUrl(result.canonicalTicketUrl)) {
      metrics.correctTicketLinksResolved += 1;
      metrics.eventsWithCanonicalTicketUrl += 1;
    }
    if (result.canonicalTicketUrl && isMerchandiseUrl(result.canonicalTicketUrl)) {
      metrics.merchandiseLinksPublishedAsTickets += 1;
    }
    if (result.identityResult === 'ticket_identity_verified') {
      metrics.providerIdentitiesVerified += 1;
    }
    const admissionCount =
      result.ticketEvidence?.offers.filter((o) => isAdmissionOfferRole(o.role ?? 'unknown_addon')).length ?? 0;
    if (admissionCount > 0) {
      metrics.eventsWithAdmissionOffer += 1;
    }
    const lowest = result.ticketEvidence ? lowestAdmissionOffer(result.ticketEvidence) : undefined;
    if (lowest?.amountMinor !== undefined) {
      metrics.eventsWithVerifiedPrice += 1;
    }
    if (result.ticketEvidence?.normalizedStatus) {
      metrics.eventsWithVerifiedStatus += 1;
    }
    if (result.ticketEvidence?.statusLabel) {
      metrics.eventsWithStatusBadge += 1;
    }
    if (result.verifiedTicketComplete) {
      metrics.verifiedTicketComplete += 1;
    } else if (!result.ticketEvidence) {
      metrics.linkedEventsWithoutTicketRow += 1;
    }
  }

  return metrics;
}

export function computeTicketAuditCountersFromResults(
  results: VerifiedTicketCompleteResult[],
): TicketAuditCounters {
  const counters = createEmptyTicketAuditCounters();

  for (const result of results) {
    if (result.discoveredLinks.length === 0) {
      counters.ticketLinkDetectionFailures += 1;
    }
    if (result.rejectedCandidates.some((r) => r.reason === 'shop_root' || r.reason === 'checkout_url')) {
      counters.ticketRedirectResolutionFailures += 1;
    }
    if (result.canonicalTicketUrl && isMerchandiseUrl(result.canonicalTicketUrl)) {
      counters.merchandiseLinksPublishedAsTickets += 1;
    }
    if (result.identityResult === 'ticket_identity_conflict') {
      counters.ticketIdentityConflicts += 1;
    }
    if (result.identityResult === 'ticket_identity_unverifiable') {
      counters.ticketIdentityUnverifiable += 1;
    }
    if (!result.ticketEvidence) {
      counters.linkedEventsWithoutTicketRow += 1;
    }
    const lowest = result.ticketEvidence ? lowestAdmissionOffer(result.ticketEvidence) : undefined;
    if (!lowest?.amountMinor) {
      counters.linkedEventsWithoutVerifiedPrice += 1;
    }
    if (!result.ticketEvidence?.normalizedStatus) {
      counters.linkedEventsWithoutVerifiedStatus += 1;
    }
    if (!result.canonicalTicketUrl) {
      counters.linkedEventsWithoutCanonicalUrl += 1;
    }
    if (!result.ticketEvidence?.statusLabel) {
      counters.linkedEventsWithoutStatusBadge += 1;
    }
    if (result.classification === 'ticket_provider_unsupported') {
      counters.unsupportedProviderPublishedAsVerified += 1;
    }
  }

  return counters;
}
