import type { TicketEventResolutionClass, TicketPriceEvidenceState } from './types';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';

export interface M6_4ClosureMetrics {
  eventsAudited: number;
  eventsWithResolvedTicketRelationship: number;
  eventsWithResolvedActionKind: number;
  eventsWithStatusOrVerifiedUnavailability: number;
  eventsWithStatusBadge: number;
  eventsWithPriceEvidenceState: number;
  eventsWithoutPriceEvidenceState: number;
  internalPipelineFailures: number;
  wrongTicketAssignments: number;
  merchandiseLinksPublishedAsTickets: number;
  addonPricesPublishedAsAdmissionPrice: number;
  unknownPricesPublishedAsZero: number;
  historicalEvidencePublishedAsCurrent: number;
  availableTicketsWithoutVerifiedCurrentPrice: number;
  ticketIdentityConflicts: number;
  unresolvedTicketRelationships: number;
  providerAccessUnavailable: number;
  resolutionDistribution: Record<TicketEventResolutionClass, number>;
}

export function computeM6_4ClosureMetrics(results: VerifiedTicketCompleteResult[]): M6_4ClosureMetrics {
  const resolutionDistribution: Record<string, number> = {};
  const metrics: M6_4ClosureMetrics = {
    eventsAudited: results.length,
    eventsWithResolvedTicketRelationship: 0,
    eventsWithResolvedActionKind: 0,
    eventsWithStatusOrVerifiedUnavailability: 0,
    eventsWithStatusBadge: 0,
    eventsWithPriceEvidenceState: 0,
    eventsWithoutPriceEvidenceState: 0,
    internalPipelineFailures: 0,
    wrongTicketAssignments: 0,
    merchandiseLinksPublishedAsTickets: 0,
    addonPricesPublishedAsAdmissionPrice: 0,
    unknownPricesPublishedAsZero: 0,
    historicalEvidencePublishedAsCurrent: 0,
    availableTicketsWithoutVerifiedCurrentPrice: 0,
    ticketIdentityConflicts: 0,
    unresolvedTicketRelationships: 0,
    providerAccessUnavailable: 0,
    resolutionDistribution: resolutionDistribution as Record<TicketEventResolutionClass, number>,
  };

  for (const result of results) {
    const resolution = result.resolutionClass ?? 'unresolved_ticket_relationship';
    resolutionDistribution[resolution] = (resolutionDistribution[resolution] ?? 0) + 1;

    if (result.primaryLink && result.canonicalTicketUrl) {
      metrics.eventsWithResolvedTicketRelationship += 1;
    }
    if (result.resolvedAction?.kind) {
      metrics.eventsWithResolvedActionKind += 1;
    }
    if (result.statusProjection?.statusLabel) {
      metrics.eventsWithStatusBadge += 1;
      metrics.eventsWithStatusOrVerifiedUnavailability += 1;
    }
    if (result.priceEvidence?.state) {
      metrics.eventsWithPriceEvidenceState += 1;
    } else {
      metrics.eventsWithoutPriceEvidenceState += 1;
    }
    if (resolution === 'internal_pipeline_failure') {
      metrics.internalPipelineFailures += 1;
    }
    if (resolution === 'ticket_identity_conflict') {
      metrics.ticketIdentityConflicts += 1;
    }
    if (resolution === 'unresolved_ticket_relationship') {
      metrics.unresolvedTicketRelationships += 1;
    }
    if (resolution === 'provider_access_unavailable') {
      metrics.providerAccessUnavailable += 1;
    }
    if (result.priceEvidence?.state === 'verified_current' && result.priceEvidence.amountMinor === 0) {
      metrics.unknownPricesPublishedAsZero += 1;
    }
    if (
      result.statusProjection?.availabilityStatus === 'available' &&
      result.priceEvidence?.state !== 'verified_current'
    ) {
      metrics.availableTicketsWithoutVerifiedCurrentPrice += 1;
    }
  }

  return metrics;
}

export function decideM6Closure(metrics: M6_4ClosureMetrics): 'M6_CLOSED' | 'M6_CLOSED_WITH_HONEST_TICKET_GAPS' | 'M6_NOT_CLOSED' {
  if (
    metrics.internalPipelineFailures > 0 ||
    metrics.ticketIdentityConflicts > 0 ||
    metrics.unresolvedTicketRelationships > 0 ||
    metrics.merchandiseLinksPublishedAsTickets > 0 ||
    metrics.addonPricesPublishedAsAdmissionPrice > 0 ||
    metrics.unknownPricesPublishedAsZero > 0 ||
    metrics.historicalEvidencePublishedAsCurrent > 0 ||
    metrics.availableTicketsWithoutVerifiedCurrentPrice > 0
  ) {
    return 'M6_NOT_CLOSED';
  }
  if (
    metrics.eventsAudited === 30 &&
    metrics.eventsWithResolvedTicketRelationship === 30 &&
    metrics.eventsWithResolvedActionKind === 30 &&
    metrics.eventsWithPriceEvidenceState === 30
  ) {
    const allComplete = (metrics.resolutionDistribution.verified_ticket_complete ?? 0) === 30;
    if (allComplete) {
      return 'M6_CLOSED';
    }
    return 'M6_CLOSED_WITH_HONEST_TICKET_GAPS';
  }
  return 'M6_NOT_CLOSED';
}
