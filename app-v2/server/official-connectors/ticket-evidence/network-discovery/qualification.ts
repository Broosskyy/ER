import type { EnrichedTicketIoEvent, QualificationState } from './detail-types';

const CHRIS_STUSSY_CANONICAL = '8a8eb9b7-593e-45de-926d-2514735b86cc';
const CHRIS_STASSY_ARCHIVED = '2c00fbb7-baa9-47eb-aaa5-52cda45c79a1';

export function qualifyEnrichedEvent(event: EnrichedTicketIoEvent): QualificationState {
  if (
    (event.detailAccess === 'BLOCKED_BY_SECURITY' ||
      event.detailAccess === 'PROVIDER_ACCESS_UNAVAILABLE' ||
      event.detailAccess === 'DETAIL_NOT_FOUND') &&
    event.products.every((product) => product.category === 'UNKNOWN')
  ) {
    return 'INACCESSIBLE_REVIEW';
  }

  if (event.relevance === 'IRRELEVANT') {
    return 'IRRELEVANT';
  }

  if (
    event.matchClassification === 'EXISTING_EXACT' ||
    event.matchClassification === 'EXISTING_STRONG_MATCH'
  ) {
    if (event.matchedEventId === CHRIS_STASSY_ARCHIVED) {
      return 'EXISTING';
    }
    return 'EXISTING';
  }

  if (event.relevance === 'AMBIGUOUS' || event.matchClassification === 'REVIEW_REQUIRED' || event.matchClassification === 'POSSIBLE_MATCH') {
    return 'AMBIGUOUS_REVIEW';
  }

  const strongRelevance = event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT';
  const hasIdentity = Boolean(event.title && event.startsAt && event.eventUrl);
  const hasTicketEvidence =
    event.detailAccess === 'DETAIL_ACCESSIBLE' ||
    event.detailAccess === 'PARTIAL_DETAIL' ||
    event.currentAdmissionPriceMinor != null;
  const lifecycleOk = event.lifecycle === 'UPCOMING' || event.lifecycle === 'ONGOING';

  if (strongRelevance && hasIdentity && hasTicketEvidence && lifecycleOk && event.matchClassification === 'NET_NEW') {
    return 'IMPORT_CANDIDATE';
  }

  return 'AMBIGUOUS_REVIEW';
}

export function calculateImportReadinessScore(event: EnrichedTicketIoEvent): number {
  let score = 0;

  if (event.relevance === 'HIGH_RELEVANCE') score += 20;
  if (event.relevance === 'LIKELY_RELEVANT') score += 12;
  if (event.title && event.startsAt) score += 15;
  if (event.venueName) score += 10;
  if (event.city) score += 5;
  if (event.eventUrl) score += 10;
  if (event.currentAdmissionPriceMinor != null) score += 10;
  if (event.ticketAction === 'PURCHASE') score += 5;
  if (event.descriptionQualification !== 'NO_DESCRIPTION') score += 8;
  if (event.lineupQualification === 'FULL_LINEUP') score += 8;
  if (event.lineupQualification === 'PARTIAL_LINEUP') score += 4;
  if (event.genreCandidates.some((genre) => genre.confidence !== 'weak_inferred')) score += 5;
  if (event.bestMediaUrl) score += 7;
  if (event.verifiedOutbound.some((source) => source.verified)) score += 7;
  if (event.detailAccess === 'DETAIL_ACCESSIBLE') score += 5;
  if (event.matchedEventId === CHRIS_STUSSY_CANONICAL) score = 0;

  return Math.min(100, score);
}

export function protectGoldenDuplicates(event: EnrichedTicketIoEvent): EnrichedTicketIoEvent {
  if (event.matchedEventId === CHRIS_STASSY_ARCHIVED) {
    return {
      ...event,
      matchedEventId: CHRIS_STUSSY_CANONICAL,
      matchClassification: 'EXISTING_EXACT',
      qualification: 'EXISTING',
      matchReasons: [...event.matchReasons, 'golden_duplicate_protection:stassy_to_stussy'],
    };
  }
  return event;
}
