import { matchingConfig } from '@/features/import/matching/matching-config';
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

    for (const event of catalog.events) {
      const score = this.scoreCandidateAgainstEvent(
        candidate,
        event,
        matchedVenueId,
        matchedArtistIds,
      );
      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }

    const isDuplicate = bestScore >= matchingConfig.duplicateThreshold;

    return {
      duplicateScore: bestScore,
      duplicateEventId: isDuplicate ? bestEvent?.id : undefined,
      duplicateEvent: isDuplicate ? bestEvent : undefined,
      isDuplicate,
      warning: isDuplicate
        ? `Potential duplicate detected (score ${bestScore}).`
        : undefined,
    };
  }

  private scoreCandidateAgainstEvent(
    candidate: NormalizedEventCandidate,
    event: KnownEventForDuplicateCheck,
    matchedVenueId?: string,
    matchedArtistIds: string[] = [],
  ): number {
    if (
      candidate.externalId &&
      event.externalId &&
      normalizeMatchText(candidate.externalId) === normalizeMatchText(event.externalId)
    ) {
      return matchingConfig.scores.externalId;
    }

    const sameDay = sameCalendarDay(candidate.startDate, event.startDate);
    if (!sameDay) return 0;

    const titleScore = tokenSimilarity(candidate.title, event.title);
    if (titleScore < 70) return 0;

    let score = 0;

    if (
      matchedVenueId &&
      event.venueId &&
      matchedVenueId === event.venueId &&
      titleScore >= 80
    ) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
    }

    if (
      candidate.venueName &&
      event.venueName &&
      tokenSimilarity(candidate.venueName, event.venueName) >= 85 &&
      titleScore >= 80
    ) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
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
      }
    }

    const candidateArtists = candidate.artistNames ?? [];
    const eventArtists = event.artistNames ?? [];
    if (candidateArtists.length > 0 && eventArtists.length > 0 && titleScore >= 75) {
      for (const artist of candidateArtists) {
        for (const eventArtist of eventArtists) {
          if (tokenSimilarity(artist, eventArtist) >= 90) {
            score = Math.max(score, matchingConfig.scores.titleDateArtist);
          }
        }
      }
    }

    if (candidate.eventUrl && event.eventUrl && candidate.eventUrl === event.eventUrl) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
    }

    if (candidate.ticketUrl && event.ticketUrl && candidate.ticketUrl === event.ticketUrl) {
      score = Math.max(score, matchingConfig.scores.titleDateVenue);
    }

    return score;
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
