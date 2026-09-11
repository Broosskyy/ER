import { resolveCityFromEvidence } from './city-resolution';
import { enrichCandidateWithDetail } from './detail-enrichment';
import { fetchTicketIoEventDetail } from './detail-fetch';
import { classifyEventMediaAcceptability } from './event-media-quality';
import type { EnrichedTicketIoEvent } from './detail-types';
import { qualifyDescription } from './field-evidence';
import { isGenericNonEventSupplementalUrl } from './supplemental-authority';
import type { TicketIoEventDiscoveryCandidate } from './types';

export interface LiveFirstBatchVerification {
  identityKey: string;
  verifiedAt: string;
  referenceDateLocal: string;
  liveAccessible: boolean;
  detailAccess: EnrichedTicketIoEvent['detailAccess'];
  title: string;
  startsAt?: string;
  venueName?: string;
  city?: string;
  citySource?: string;
  descriptionQualification: EnrichedTicketIoEvent['descriptionQualification'];
  lineup: string[];
  lineupQualification: EnrichedTicketIoEvent['lineupQualification'];
  genres: EnrichedTicketIoEvent['genreCandidates'];
  relevance: EnrichedTicketIoEvent['relevance'];
  relevanceReasons: string[];
  bestMediaUrl?: string;
  mediaAcceptability: string;
  verifiedSupplementalUrl?: string;
  products: EnrichedTicketIoEvent['products'];
  currentAdmissionPriceMinor?: number;
  currentAdmissionPhase?: string;
  ticketAvailability: EnrichedTicketIoEvent['ticketAvailability'];
  ticketAction: EnrichedTicketIoEvent['ticketAction'];
  ticketEventUrl: string;
  matchClassification: EnrichedTicketIoEvent['matchClassification'];
  importReadinessScore?: number;
  uncertainties: string[];
  visualQaScreenshot?: string;
}

function artifactToCandidate(event: EnrichedTicketIoEvent): TicketIoEventDiscoveryCandidate {
  return {
    identityKey: event.identityKey,
    ticketIoEventId: event.ticketIoEventId,
    shopId: event.shopId,
    shopSlug: event.shopSlug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    lifecycle: event.lifecycle,
    venueName: event.venueName,
    city: event.city,
    ticketUrl: event.eventUrl,
    canonicalUrl: event.canonicalUrl,
    description: event.description,
    lineupHints: event.lineupHints,
    genreHints: event.genreHints,
    outboundLinks: event.outboundLinks,
    imageUrls: event.imageUrls,
    listRawPrice: event.currentAdmissionLabel,
    listAmountMinor: event.currentAdmissionPriceMinor,
    listCurrency: 'EUR',
    visibleProducts: [],
    relevance: event.relevance,
    relevanceReasons: event.relevanceReasons,
    matchClassification: event.matchClassification,
    matchReasons: event.matchReasons,
    mediaRoles: event.mediaRoles,
    discoveredFromSurfaces: ['m9_3b_1b_live'],
  };
}

export async function verifyFirstBatchCandidateLive(
  artifactEvent: EnrichedTicketIoEvent,
  referenceDateLocal: string,
): Promise<{
  verification: LiveFirstBatchVerification;
  enriched: EnrichedTicketIoEvent;
  fetchResult: import('./detail-fetch').DetailFetchResult;
}> {
  const fetchResult = await fetchTicketIoEventDetail(artifactEvent.eventUrl);
  const enriched = enrichCandidateWithDetail(
    artifactToCandidate(artifactEvent),
    fetchResult,
    [],
    artifactEvent.listingUrl,
  );

  const cityResolution = resolveCityFromEvidence({
    title: enriched.title,
    description: enriched.description,
    address: enriched.address,
    venueName: enriched.venueName,
    outboundLinks: enriched.outboundLinks,
  });

  const media = classifyEventMediaAcceptability(enriched.imageUrls, { title: enriched.title });
  const verifiedSupplemental = enriched.verifiedOutbound.find(
    (source) => source.verified && !isGenericNonEventSupplementalUrl(source.url),
  );

  const uncertainties: string[] = [];
  if (/redirectFromEventInPast=1/i.test(enriched.eventUrl) || /redirectFromEventInPast=1/i.test(fetchResult.finalUrl)) {
    uncertainties.push('event_past_redirect');
  }
  if (media.acceptability !== 'ACCEPTABLE_EVENT_MEDIA') {
    uncertainties.push(media.acceptability);
  }
  if (!cityResolution.city) {
    uncertainties.push('city_unresolved');
  }
  if (enriched.relevance === 'LIKELY_RELEVANT') {
    uncertainties.push('likely_relevant_only');
  }
  if (qualifyDescription(enriched.description) === 'NO_DESCRIPTION') {
    uncertainties.push('no_description');
  }

  const verification: LiveFirstBatchVerification = {
    identityKey: enriched.identityKey,
    verifiedAt: new Date().toISOString(),
    referenceDateLocal,
    liveAccessible: enriched.detailAccess === 'DETAIL_ACCESSIBLE' || enriched.detailAccess === 'PARTIAL_DETAIL',
    detailAccess: enriched.detailAccess,
    title: enriched.title,
    startsAt: enriched.startsAt,
    venueName: enriched.venueName,
    city: cityResolution.city ?? enriched.city,
    citySource: cityResolution.source,
    descriptionQualification: enriched.descriptionQualification,
    lineup: enriched.lineupHints,
    lineupQualification: enriched.lineupQualification,
    genres: enriched.genreCandidates,
    relevance: enriched.relevance,
    relevanceReasons: enriched.relevanceReasons,
    bestMediaUrl: media.bestMediaUrl,
    mediaAcceptability: media.acceptability,
    verifiedSupplementalUrl: verifiedSupplemental?.url,
    products: enriched.products,
    currentAdmissionPriceMinor: enriched.currentAdmissionPriceMinor,
    currentAdmissionPhase: enriched.currentAdmissionPhase,
    ticketAvailability: enriched.ticketAvailability,
    ticketAction: enriched.ticketAction,
    ticketEventUrl: enriched.eventUrl,
    matchClassification: enriched.matchClassification,
    importReadinessScore: enriched.importReadinessScore,
    uncertainties,
  };

  return {
    verification: {
      ...verification,
      city: cityResolution.city ?? enriched.city,
    },
    enriched: {
      ...enriched,
      city: cityResolution.city ?? enriched.city,
      bestMediaUrl: media.bestMediaUrl,
    },
    fetchResult,
  };
}

export function passesFirstBatchAcceptanceGate(verification: LiveFirstBatchVerification): boolean {
  const relevanceOk =
    verification.relevance === 'HIGH_RELEVANCE' ||
    (verification.relevance === 'LIKELY_RELEVANT' && verification.uncertainties.length <= 2);
  return (
    relevanceOk &&
    verification.matchClassification === 'NET_NEW' &&
    Boolean(verification.title && verification.startsAt && verification.venueName && verification.city) &&
    verification.liveAccessible &&
    verification.detailAccess === 'DETAIL_ACCESSIBLE' &&
    !verification.uncertainties.includes('event_past_redirect') &&
    verification.ticketAction === 'PURCHASE' &&
    verification.currentAdmissionPriceMinor != null &&
    verification.mediaAcceptability === 'ACCEPTABLE_EVENT_MEDIA'
  );
}
