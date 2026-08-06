import { normalizeTicketIoEventUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { matchingConfig } from '@/features/import/matching/matching-config';
import { evaluateEventOwnershipMatch } from '@/features/import/matching/event-ownership-decision';
import type { EventOwnershipDecision } from '@/features/import/matching/event-ownership-decision';
import type { KnownEventForDuplicateCheck, MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import {
  haversineKm,
  normalizeMatchText,
  sameCalendarDay,
  tokenSimilarity,
} from '@/features/import/matching/matching-utils';

export interface DuplicateDetectionOutcome {
  duplicateScore: number;
  duplicateEventId?: string;
  duplicateEvent?: KnownEventForDuplicateCheck;
  isDuplicate: boolean;
  warning?: string;
  ownershipDecision?: EventOwnershipDecision;
}

function normalizeVenueForDuplicateMatch(venueName: string | undefined): string {
  if (!venueName?.trim()) {
    return '';
  }
  const primary = venueName.split('/')[0]?.split(',')[0]?.trim() ?? venueName;
  return normalizeMatchText(primary);
}

function normalizeTicketPurchaseUrl(url: string): string | undefined {
  const ticketIo = normalizeTicketIoEventUrl(url);
  if (ticketIo) {
    return ticketIo;
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.toLowerCase().includes('ticketkings.de')) {
      const path = parsed.pathname.replace(/\/+$/, '') || '/';
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${path}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function ticketUrlsReferToSameEvent(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }
  const normalizedLeft = normalizeTicketPurchaseUrl(left);
  const normalizedRight = normalizeTicketPurchaseUrl(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function collectComparableUrls(candidate: NormalizedEventCandidate): string[] {
  return [candidate.ticketUrl, candidate.externalId, candidate.eventUrl, candidate.originalLink].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );
}

function collectEventUrls(event: KnownEventForDuplicateCheck): string[] {
  return [event.ticketUrl, event.externalId, event.eventUrl].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );
}

export class DuplicateDetectionService {
  detect(
    candidate: NormalizedEventCandidate,
    catalog: MatchingCatalog,
    matchedVenueId?: string,
    matchedArtistIds: string[] = [],
  ): DuplicateDetectionOutcome {
    let bestScore = 0;
    let bestEvent: KnownEventForDuplicateCheck | undefined;
    let bestOwnership: EventOwnershipDecision | undefined;

    for (const event of catalog.events) {
      const ownership = evaluateEventOwnershipMatch({
        candidate,
        event,
        matchedVenueId,
      });
      if (ownership.conflictSignals.some((signal) => signal !== 'title_conflict_severe')) {
        continue;
      }

      const score = this.scoreCandidateAgainstEvent(
        candidate,
        event,
        matchedVenueId,
        matchedArtistIds,
        ownership,
      );
      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
        bestOwnership = ownership;
      }
    }

    const isDuplicate =
      bestScore >= matchingConfig.duplicateThreshold &&
      (bestOwnership?.conflictSignals.filter((signal) => signal !== 'title_conflict_severe').length ?? 0) ===
        0;

    return {
      duplicateScore: bestScore,
      duplicateEventId: isDuplicate ? bestEvent?.id : undefined,
      duplicateEvent: isDuplicate ? bestEvent : undefined,
      isDuplicate,
      ownershipDecision: bestOwnership,
      warning: isDuplicate
        ? `Potential duplicate detected (score ${bestScore}).`
        : bestOwnership?.requiresReview
          ? 'Ambiguous ownership candidate requires review.'
          : undefined,
    };
  }

  scoreCandidateAgainstEvent(
    candidate: NormalizedEventCandidate,
    event: KnownEventForDuplicateCheck,
    matchedVenueId?: string,
    _matchedArtistIds: string[] = [],
    ownership?: EventOwnershipDecision,
  ): number {
    const ownershipDecision =
      ownership ??
      evaluateEventOwnershipMatch({
        candidate,
        event,
        matchedVenueId,
      });

    if (ownershipDecision.conflictSignals.some((signal) => signal !== 'title_conflict_severe')) {
      return 0;
    }

    if (
      candidate.externalId &&
      event.externalId &&
      normalizeMatchText(candidate.externalId) === normalizeMatchText(event.externalId)
    ) {
      return matchingConfig.scores.externalId;
    }

    const sameDay = sameCalendarDay(candidate.startDate, event.startDate);
    if (!sameDay) {
      return 0;
    }

    const isEnrichmentSource = candidate.sourceMetadata?.enrichmentSource === true;
    const minTitleScore = isEnrichmentSource ? 60 : 70;
    const titleScore = tokenSimilarity(candidate.title, event.title);
    if (titleScore < minTitleScore) {
      return 0;
    }

    let score = 0;
    let hasStrongSignal = false;

    if (
      matchedVenueId &&
      event.venueId &&
      matchedVenueId === event.venueId &&
      titleScore >= (isEnrichmentSource ? 60 : 80)
    ) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
      hasStrongSignal = true;
    }

    if (
      candidate.venueName &&
      event.venueName &&
      tokenSimilarity(candidate.venueName, event.venueName) >= 85 &&
      titleScore >= 80
    ) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
      hasStrongSignal = true;
    }

    const candidateVenue = normalizeVenueForDuplicateMatch(candidate.venueName);
    const eventVenue = normalizeVenueForDuplicateMatch(event.venueName);
    if (
      isEnrichmentSource &&
      candidateVenue &&
      eventVenue &&
      (candidateVenue === eventVenue || tokenSimilarity(candidateVenue, eventVenue) >= 92) &&
      titleScore >= 60
    ) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
      hasStrongSignal = true;
    }

    if (
      candidate.latitude !== undefined &&
      candidate.longitude !== undefined &&
      event.latitude !== undefined &&
      event.longitude !== undefined
    ) {
      const distance = haversineKm(
        candidate.latitude,
        candidate.longitude,
        event.latitude,
        event.longitude,
      );
      if (distance <= matchingConfig.venueCoordinateRadiusKm && titleScore >= 80) {
        score = Math.max(score, matchingConfig.scores.titleDateCoordinates);
        hasStrongSignal = true;
      }
    }

    if (candidate.eventUrl && event.eventUrl && candidate.eventUrl === event.eventUrl) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
      hasStrongSignal = true;
    }

    if (candidate.ticketUrl && event.ticketUrl) {
      const left = normalizeTicketIoEventUrl(candidate.ticketUrl);
      const right = normalizeTicketIoEventUrl(event.ticketUrl);
      if (left === right) {
        score = Math.max(score, matchingConfig.scores.titleDateVenue);
        hasStrongSignal = true;
      }
    }

    const candidateUrls = collectComparableUrls(candidate);
    const eventUrls = collectEventUrls(event);
    for (const candidateUrl of candidateUrls) {
      for (const eventUrl of eventUrls) {
        if (ticketUrlsReferToSameEvent(candidateUrl, eventUrl)) {
          score = Math.max(score, matchingConfig.scores.titleDateVenue);
          hasStrongSignal = true;
        }
      }
    }

    const candidateArtists = candidate.artistNames ?? [];
    const eventArtists = event.artistNames ?? [];
    if (hasStrongSignal && candidateArtists.length > 0 && eventArtists.length > 0 && titleScore >= 75) {
      for (const artist of candidateArtists) {
        for (const eventArtist of eventArtists) {
          if (tokenSimilarity(artist, eventArtist) >= 90) {
            score = Math.min(100, score + 8);
          }
        }
      }
    }

    if (!hasStrongSignal) {
      return Math.min(score, matchingConfig.duplicateThreshold - 1);
    }

    return score;
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
