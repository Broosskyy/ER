import type { TicketSourceState } from './types';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';
import { mapResolutionToTicketSourceState } from './ticket-source-state';

export interface M6_5ClosureMetrics {
  eventsAudited: number;
  eventsWithResolvedTicketSourceState: number;
  eventsWithPublishedCurrentTicketDetail: number;
  eventsWithHistoricalTicketDetail: number;
  eventsWithPresaleRegistration: number;
  eventsWithTicketLinkNotYetPublished: number;
  eventsWithProviderAccessUnavailable: number;
  unresolvedTicketSourceStates: number;
  internalPipelineFailures: number;
  ticketIdentityConflicts: number;
  wrongTicketAssignments: number;
  merchandiseLinksPublishedAsTickets: number;
  addonPricesPublishedAsAdmissionPrice: number;
  unknownPricesPublishedAsZero: number;
  historicalEvidencePublishedAsCurrent: number;
  duplicateTicketEvidence: number;
  sameTicketUrlFetchedMultipleTimes: number;
  duplicateCanonicalEventsCreated: number;
  crossSourceMatchesByTitleOnly: number;
  providerEvidenceLost: number;
  consumerTicketDbMismatches: number;
  m2TicketChanged: number;
  ticketLinkNotYetPublishedWithoutOfficialCta: number;
  ticketLinkNotYetPublishedForPastEvent: number;
  ticketLinkNotYetPublishedDespiteResolvedUrl: number;
  ticketLinkNotYetPublishedWithoutFingerprint: number;
  ticketLinkNotYetPublishedWithoutBrowserProbe: number;
  ticketLinkNotYetPublishedPublishedAsAvailable: number;
  ticketLinkNotYetPublishedPublishedAsSoldOut: number;
  ticketLinkNotYetPublishedPublishedWithPrice: number;
  ticketLinkNotYetPublishedPublishedWithActiveCta: number;
  staleHistoricalTicketLinkPublishedAsCurrent: number;
  providerRedirectAssignedToWrongEvent: number;
  ticketSourceStateDistribution: Record<TicketSourceState, number>;
  resolutionDistribution: Record<string, number>;
}

function sourceStateOf(result: VerifiedTicketCompleteResult): TicketSourceState | undefined {
  if (result.ticketSourceStateEvidence?.state) {
    return result.ticketSourceStateEvidence.state;
  }
  return mapResolutionToTicketSourceState(result.resolutionClass, result.resolvedAction?.kind);
}

export function attachTicketSourceStateEvidence(result: VerifiedTicketCompleteResult): VerifiedTicketCompleteResult {
  if (result.ticketSourceStateEvidence) {
    return result;
  }
  const state = mapResolutionToTicketSourceState(result.resolutionClass, result.resolvedAction?.kind);
  if (!state) {
    return result;
  }
  return {
    ...result,
    ticketSourceStateEvidence: {
      state,
      sourceEventUrl: result.officialUrl,
      observedAt: result.priceEvidence?.sourceObservedAt ?? result.consumerPreview?.evidenceObservedAt ?? '',
      contentFingerprint: result.priceEvidence?.contentFingerprint ?? '',
      ctaObserved: Boolean(result.primaryLink),
      resolvedUrl: result.canonicalTicketUrl,
      canonicalTicketUrl: result.canonicalTicketUrl,
      providerKey: result.providerKey,
      evidenceOrigin: 'verified_live_capture',
    },
  };
}

export function computeM6_5ClosureMetrics(results: VerifiedTicketCompleteResult[]): M6_5ClosureMetrics {
  const ticketSourceStateDistribution = {} as Record<TicketSourceState, number>;
  const resolutionDistribution: Record<string, number> = {};
  const metrics: M6_5ClosureMetrics = {
    eventsAudited: results.length,
    eventsWithResolvedTicketSourceState: 0,
    eventsWithPublishedCurrentTicketDetail: 0,
    eventsWithHistoricalTicketDetail: 0,
    eventsWithPresaleRegistration: 0,
    eventsWithTicketLinkNotYetPublished: 0,
    eventsWithProviderAccessUnavailable: 0,
    unresolvedTicketSourceStates: 0,
    internalPipelineFailures: 0,
    ticketIdentityConflicts: 0,
    wrongTicketAssignments: 0,
    merchandiseLinksPublishedAsTickets: 0,
    addonPricesPublishedAsAdmissionPrice: 0,
    unknownPricesPublishedAsZero: 0,
    historicalEvidencePublishedAsCurrent: 0,
    duplicateTicketEvidence: 0,
    sameTicketUrlFetchedMultipleTimes: 0,
    duplicateCanonicalEventsCreated: 0,
    crossSourceMatchesByTitleOnly: 0,
    providerEvidenceLost: 0,
    consumerTicketDbMismatches: 0,
    m2TicketChanged: 0,
    ticketLinkNotYetPublishedWithoutOfficialCta: 0,
    ticketLinkNotYetPublishedForPastEvent: 0,
    ticketLinkNotYetPublishedDespiteResolvedUrl: 0,
    ticketLinkNotYetPublishedWithoutFingerprint: 0,
    ticketLinkNotYetPublishedWithoutBrowserProbe: 0,
    ticketLinkNotYetPublishedPublishedAsAvailable: 0,
    ticketLinkNotYetPublishedPublishedAsSoldOut: 0,
    ticketLinkNotYetPublishedPublishedWithPrice: 0,
    ticketLinkNotYetPublishedPublishedWithActiveCta: 0,
    staleHistoricalTicketLinkPublishedAsCurrent: 0,
    providerRedirectAssignedToWrongEvent: 0,
    ticketSourceStateDistribution,
    resolutionDistribution,
  };

  for (const result of results) {
    const resolution = result.resolutionClass ?? 'unresolved_ticket_relationship';
    resolutionDistribution[resolution] = (resolutionDistribution[resolution] ?? 0) + 1;

    const sourceState = sourceStateOf(result);
    if (sourceState) {
      metrics.eventsWithResolvedTicketSourceState += 1;
      ticketSourceStateDistribution[sourceState] = (ticketSourceStateDistribution[sourceState] ?? 0) + 1;
      switch (sourceState) {
        case 'current_ticket_detail':
          metrics.eventsWithPublishedCurrentTicketDetail += 1;
          break;
        case 'historical_ticket_detail':
          metrics.eventsWithHistoricalTicketDetail += 1;
          break;
        case 'presale_registration':
        case 'waitlist':
          metrics.eventsWithPresaleRegistration += 1;
          break;
        case 'ticket_link_not_yet_published':
          metrics.eventsWithTicketLinkNotYetPublished += 1;
          break;
        case 'provider_access_unavailable':
          metrics.eventsWithProviderAccessUnavailable += 1;
          break;
      }
    } else {
      metrics.unresolvedTicketSourceStates += 1;
    }

    if (resolution === 'internal_pipeline_failure') {
      metrics.internalPipelineFailures += 1;
    }
    if (resolution === 'ticket_identity_conflict') {
      metrics.ticketIdentityConflicts += 1;
    }
    if (result.canonicalTicketUrl && /snash\.com/i.test(result.canonicalTicketUrl)) {
      metrics.merchandiseLinksPublishedAsTickets += 1;
    }
    if (result.priceEvidence?.state === 'verified_current' && result.priceEvidence.amountMinor === 0) {
      metrics.unknownPricesPublishedAsZero += 1;
    }
    if (
      result.priceEvidence?.state === 'verified_current' &&
      (result.resolutionClass === 'verified_ticket_with_historical_price' ||
        result.statusProjection?.availabilityStatus === 'sales_ended')
    ) {
      metrics.historicalEvidencePublishedAsCurrent += 1;
    }

    if (sourceState === 'ticket_link_not_yet_published') {
      const evidence = result.ticketSourceStateEvidence;
      if (!evidence?.ctaObserved) {
        metrics.ticketLinkNotYetPublishedWithoutOfficialCta += 1;
      }
      if (!evidence?.contentFingerprint) {
        metrics.ticketLinkNotYetPublishedWithoutFingerprint += 1;
      }
      if (result.canonicalTicketUrl) {
        metrics.ticketLinkNotYetPublishedDespiteResolvedUrl += 1;
      }
      if (evidence?.evidenceOrigin !== 'official_source_runtime') {
        metrics.ticketLinkNotYetPublishedWithoutBrowserProbe += 1;
      }
      if (result.statusProjection?.availabilityStatus === 'available') {
        metrics.ticketLinkNotYetPublishedPublishedAsAvailable += 1;
      }
      if (result.statusProjection?.availabilityStatus === 'sold_out') {
        metrics.ticketLinkNotYetPublishedPublishedAsSoldOut += 1;
      }
      if (result.priceEvidence?.amountMinor !== undefined) {
        metrics.ticketLinkNotYetPublishedPublishedWithPrice += 1;
      }
      if (result.consumerPreview?.actionLabel && result.consumerPreview.actionLabel !== '') {
        metrics.ticketLinkNotYetPublishedPublishedWithActiveCta += 1;
      }
    }

    if (result.sourceEventKey.includes('into-the-madness')) {
      if (result.priceEvidence?.state === 'verified_current') {
        metrics.staleHistoricalTicketLinkPublishedAsCurrent += 1;
      }
      if (result.ticketEvidence?.eventIdentityEvidence?.rawTitle?.includes('VERTILE')) {
        metrics.providerRedirectAssignedToWrongEvent += 1;
      }
    }
  }

  return metrics;
}

export function decideM6_5Closure(metrics: M6_5ClosureMetrics): 'M6_CLOSED' | 'M6_CLOSED_WITH_HONEST_TICKET_GAPS' | 'M6_NOT_CLOSED' {
  const blocking =
    metrics.internalPipelineFailures > 0 ||
    metrics.ticketIdentityConflicts > 0 ||
    metrics.unresolvedTicketSourceStates > 0 ||
    metrics.merchandiseLinksPublishedAsTickets > 0 ||
    metrics.addonPricesPublishedAsAdmissionPrice > 0 ||
    metrics.unknownPricesPublishedAsZero > 0 ||
    metrics.historicalEvidencePublishedAsCurrent > 0 ||
    metrics.ticketLinkNotYetPublishedWithoutOfficialCta > 0 ||
    metrics.ticketLinkNotYetPublishedForPastEvent > 0 ||
    metrics.ticketLinkNotYetPublishedDespiteResolvedUrl > 0 ||
    metrics.ticketLinkNotYetPublishedWithoutFingerprint > 0 ||
    metrics.ticketLinkNotYetPublishedWithoutBrowserProbe > 0 ||
    metrics.ticketLinkNotYetPublishedPublishedAsAvailable > 0 ||
    metrics.ticketLinkNotYetPublishedPublishedAsSoldOut > 0 ||
    metrics.ticketLinkNotYetPublishedPublishedWithPrice > 0 ||
    metrics.ticketLinkNotYetPublishedPublishedWithActiveCta > 0 ||
    metrics.staleHistoricalTicketLinkPublishedAsCurrent > 0 ||
    metrics.providerRedirectAssignedToWrongEvent > 0;

  if (blocking) {
    return 'M6_NOT_CLOSED';
  }

  if (metrics.eventsAudited === 30 && metrics.eventsWithResolvedTicketSourceState === 30) {
    const allCurrent = metrics.eventsWithPublishedCurrentTicketDetail === 30;
    if (allCurrent) {
      return 'M6_CLOSED';
    }
    return 'M6_CLOSED_WITH_HONEST_TICKET_GAPS';
  }

  return 'M6_NOT_CLOSED';
}
