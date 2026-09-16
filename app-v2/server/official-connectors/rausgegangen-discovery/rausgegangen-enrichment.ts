import { classifyConsumerEventLifecycle } from '../../ingestion/consumer-event-cutoff';
import type { EventMatchCatalogEntry } from '../../ingestion/identity/event-match-types';
import { classifyMediaUrls } from '../ticket-evidence/network-discovery/media-classifier';
import { classifyDetailRelevance } from '../ticket-evidence/network-discovery/detail-relevance';
import {
  buildGenreCandidates,
  buildFieldEvidence,
  dedupeDescription,
  qualifyDescription,
  qualifyLineup,
  separateDescriptionFields,
  verifyOutboundSources,
} from '../ticket-evidence/network-discovery/field-evidence';
import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import {
  calculateImportReadinessScore,
  protectGoldenDuplicates,
  qualifyEnrichedEvent,
} from '../ticket-evidence/network-discovery/qualification';
import { classifyElectronicRelevance } from '../ticket-evidence/network-discovery/relevance-classifier';
import { mergeLineupHints } from '../ticket-evidence/network-discovery/lineup-from-title';
import type { RausgegangenDetailEvidence, RausgegangenDiscoveryCandidate, RausgegangenListingEntry } from './types';
import { buildRausgegangenIdentityKey, titleFromEventSlug } from './rausgegangen-url';
import { matchRausgegangenCandidateAgainstCatalog } from './match-rausgegangen-catalog';

function classifyLifecycle(
  startsAt?: string,
  endsAt?: string,
  referenceInstant: Date = new Date(),
): 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNKNOWN' {
  if (!startsAt) {
    return 'UNKNOWN';
  }
  const lifecycle = classifyConsumerEventLifecycle({
    startsAt,
    endsAt,
    status: 'published',
    referenceInstant,
  });
  if (lifecycle === 'ENDED') {
    return 'ENDED';
  }
  if (lifecycle === 'ONGOING') {
    return 'ONGOING';
  }
  return 'UPCOMING';
}

export function listingEntryToCandidate(
  entry: RausgegangenListingEntry,
  referenceInstant: Date,
): RausgegangenDiscoveryCandidate {
  const title = entry.listingTitleHint ?? titleFromEventSlug(entry.eventSlug);
  const { relevance, reasons } = classifyElectronicRelevance({ title });

  return {
    identityKey: buildRausgegangenIdentityKey(entry.eventSlug),
    eventSlug: entry.eventSlug,
    regionSlug: entry.regionSlug,
    title,
    lifecycle: 'UNKNOWN',
    lineupHints: [],
    genreHints: [],
    imageUrls: [],
    canonicalUrl: entry.eventUrl,
    listingSurfaces: [entry.listingSurface],
    relevance,
    relevanceReasons: reasons,
    matchClassification: 'REVIEW_REQUIRED',
    matchReasons: [],
    detailFetched: false,
    detailAccess: 'NOT_FETCHED',
  };
}

export function applyDetailToCandidate(
  candidate: RausgegangenDiscoveryCandidate,
  detail: RausgegangenDetailEvidence,
  referenceInstant: Date,
): RausgegangenDiscoveryCandidate {
  const title = detail.title ?? candidate.title;
  const structured = separateDescriptionFields(detail.description);
  const lineupHints = mergeLineupHints(title, [...detail.lineupHints, ...structured.lineupCandidates]);
  const genreHints = [...new Set([...candidate.genreHints, ...detail.genreHints, ...structured.genreCandidates, ...detail.tagHints])];
  const relevanceResult = classifyDetailRelevance({
    title,
    description: detail.description,
    genreHints,
    lineupHints,
    venueName: detail.venueName,
    organizerName: detail.organizerName,
    detailAccess: detail.jsonLdPresent ? 'DETAIL_ACCESSIBLE' : 'PARTIAL_DETAIL',
  });

  return {
    ...candidate,
    title,
    description: detail.description,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    lifecycle: classifyLifecycle(detail.startsAt, detail.endsAt, referenceInstant),
    venueName: detail.venueName,
    city: detail.city,
    address: detail.address,
    organizerName: detail.organizerName,
    lineupHints,
    genreHints,
    imageUrls: detail.imageUrls,
    ticketUrl: detail.ticketUrl,
    ticketPriceMinor: detail.ticketPriceMinor,
    ticketCurrency: detail.ticketCurrency,
    relevance: relevanceResult.relevance,
    relevanceReasons: relevanceResult.reasons,
    detailFetched: true,
    detailAccess: detail.jsonLdPresent ? 'DETAIL_ACCESSIBLE' : 'PARTIAL_DETAIL',
  };
}

export function enrichedFromRausgegangenCandidate(
  candidate: RausgegangenDiscoveryCandidate,
  catalog: EventMatchCatalogEntry[],
  referenceInstant: Date,
): EnrichedTicketIoEvent {
  const matched = matchRausgegangenCandidateAgainstCatalog(candidate, catalog);
  const description = dedupeDescription(candidate.description);
  const genreCandidates = buildGenreCandidates(candidate.genreHints, candidate.title, description);
  const lineupQualification = qualifyLineup(candidate.lineupHints);
  const descriptionQualification = qualifyDescription(description);
  const mediaRoles = classifyMediaUrls(candidate.imageUrls, { title: candidate.title });
  const bestMediaUrl = candidate.imageUrls[0];
  const detailAccess =
    candidate.detailAccess === 'NOT_FETCHED'
      ? 'DETAIL_NOT_FOUND'
      : candidate.detailAccess === 'BLOCKED'
        ? 'BLOCKED_BY_SECURITY'
        : candidate.detailAccess === 'DETAIL_NOT_FOUND'
          ? 'DETAIL_NOT_FOUND'
          : candidate.detailAccess;

  const base: EnrichedTicketIoEvent = {
    identityKey: matched.identityKey,
    ticketIoEventId: matched.eventSlug,
    shopId: `rausgegangen:${matched.regionSlug}`,
    shopSlug: matched.regionSlug,
    listingUrl: matched.listingSurfaces[0] ?? `https://rausgegangen.de/${matched.regionSlug}/`,
    eventUrl: matched.ticketUrl ?? matched.canonicalUrl,
    canonicalUrl: matched.canonicalUrl,
    title: matched.title,
    startsAt: matched.startsAt,
    endsAt: matched.endsAt,
    lifecycle:
      matched.lifecycle === 'UNKNOWN'
        ? 'UPCOMING'
        : matched.lifecycle,
    venueName: matched.venueName,
    city: matched.city,
    address: matched.address,
    organizerName: matched.organizerName,
    description,
    descriptionQualification,
    lineupHints: matched.lineupHints,
    lineupQualification,
    genreHints: matched.genreHints,
    genreCandidates,
    outboundLinks: matched.ticketUrl ? [matched.ticketUrl] : [],
    verifiedOutbound: verifyOutboundSources({
      title: matched.title,
      startsAt: matched.startsAt,
      venueName: matched.venueName,
      eventUrl: matched.ticketUrl ?? matched.canonicalUrl,
      outboundLinks: matched.ticketUrl ? [matched.ticketUrl] : [],
    }),
    imageUrls: matched.imageUrls,
    mediaRoles,
    bestMediaUrl,
    products: matched.ticketPriceMinor != null
      ? [
          {
            label: 'admission',
            category: 'ADMISSION',
            rawPrice: `${(matched.ticketPriceMinor / 100).toFixed(2)}`,
            amountMinor: matched.ticketPriceMinor,
            currency: matched.ticketCurrency ?? 'EUR',
            availability: 'AVAILABLE',
            soldOut: false,
            purchasable: true,
            grantsAdmission: true,
            selectedAsCurrentAdmission: true,
          },
        ]
      : [],
    currentAdmissionPriceMinor: matched.ticketPriceMinor,
    currentAdmissionLabel:
      matched.ticketPriceMinor != null
        ? `${(matched.ticketPriceMinor / 100).toFixed(2)} ${matched.ticketCurrency ?? 'EUR'}`
        : undefined,
    ticketAvailability: matched.ticketUrl ? 'AVAILABLE' : 'UNKNOWN',
    ticketAction: matched.ticketUrl ? 'PURCHASE' : 'NONE',
    detailAccess,
    fetchMethod: 'fetch',
    fetchStatus: detailAccess === 'DETAIL_ACCESSIBLE' ? 200 : undefined,
    evidenceTimestamp: referenceInstant.toISOString(),
    relevance: matched.relevance,
    relevanceReasons: matched.relevanceReasons,
    matchClassification: matched.matchClassification,
    matchedEventId: matched.matchedEventId,
    matchedEventTitle: matched.matchedEventTitle,
    matchReasons: matched.matchReasons,
    qualification: 'AMBIGUOUS_REVIEW',
    fieldEvidence: [],
  };

  base.fieldEvidence = buildFieldEvidence(base);

  const qualified = protectGoldenDuplicates({
    ...base,
    qualification: qualifyEnrichedEvent(base),
    importReadinessScore: calculateImportReadinessScore(base),
  });

  return qualified;
}
