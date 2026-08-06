import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { buildEventIdentityFingerprint } from '@/features/aggregation/identity/event-identity';
import type { KnownEventForDuplicateCheck } from '@/features/import/matching/match-result';
import { DuplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import {
  haversineKm,
  sameCalendarDay,
  tokenSimilarity,
} from '@/features/import/matching/matching-utils';
import { matchingConfig } from '@/features/import/matching/matching-config';
import type { MatchSignal } from '../domain/matching-types';

export interface MatchScoreInput {
  incoming: CanonicalImportEvent;
  candidate: KnownEventForDuplicateCheck;
  matchedVenueId?: string;
  matchedArtistIds?: string[];
  hasSourceReference?: boolean;
  hasFingerprintMatch?: boolean;
  sharedBlockingKeys?: string[];
}

export interface MatchScoreResult {
  confidenceScore: number;
  signals: MatchSignal[];
}

function pushSignal(
  signals: MatchSignal[],
  type: MatchSignal['type'],
  score: number,
  weight: number,
  message: string,
): void {
  if (score <= 0) {
    return;
  }
  signals.push({ type, weight, score, message });
}

function weightedAverage(signals: MatchSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }
  const weighted = signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0);
  return Math.round(weighted / totalWeight);
}

export class MultiSourceMatchScorer {
  constructor(private readonly duplicateDetector = new DuplicateDetectionService()) {}

  score(input: MatchScoreInput): MatchScoreResult {
    const signals: MatchSignal[] = [];
    const { incoming, candidate } = input;

    if (input.hasSourceReference) {
      pushSignal(signals, 'source_reference', 100, 1, 'Existing source reference points to canonical event.');
    }

    if (input.hasFingerprintMatch) {
      pushSignal(signals, 'fingerprint', 95, 0.95, 'Canonical fingerprint matches.');
    }

    if (input.sharedBlockingKeys && input.sharedBlockingKeys.length > 0) {
      pushSignal(
        signals,
        'blocking_key',
        Math.min(85, 60 + input.sharedBlockingKeys.length * 8),
        0.6,
        `Shared blocking keys: ${input.sharedBlockingKeys.join(', ')}`,
      );
    }

    if (
      incoming.externalId &&
      candidate.externalId &&
      incoming.externalId === candidate.externalId
    ) {
      pushSignal(signals, 'external_id', matchingConfig.scores.externalId, 1, 'External IDs match.');
    }

    if (sameCalendarDay(incoming.startDate, candidate.startDate)) {
      pushSignal(signals, 'start_date', 100, 0.8, 'Start dates fall on the same calendar day.');
    } else {
      return { confidenceScore: weightedAverage(signals), signals };
    }

    const titleScore = tokenSimilarity(incoming.title, candidate.title);
    if (titleScore > 0) {
      pushSignal(signals, 'title_similarity', titleScore, 0.85, `Title similarity ${titleScore}.`);
    }

    if (incoming.endDate && candidate.startDate) {
      const endComparable = candidate.startDate;
      if (incoming.endDate.slice(0, 10) === endComparable.slice(0, 10)) {
        pushSignal(signals, 'end_date', 90, 0.5, 'End date aligns with candidate day.');
      }
    }

    if (
      input.matchedVenueId &&
      candidate.venueId &&
      input.matchedVenueId === candidate.venueId
    ) {
      pushSignal(signals, 'venue', matchingConfig.scores.titleDateVenue, 0.9, 'Matched venue IDs align.');
    } else if (incoming.venueName && candidate.venueName) {
      const venueScore = tokenSimilarity(incoming.venueName, candidate.venueName);
      if (venueScore >= 80) {
        pushSignal(signals, 'venue', venueScore, 0.9, `Venue similarity ${venueScore}.`);
      }
    }

    if (
      incoming.latitude !== undefined &&
      incoming.longitude !== undefined &&
      candidate.latitude !== undefined &&
      candidate.longitude !== undefined
    ) {
      const distance = haversineKm(
        incoming.latitude,
        incoming.longitude,
        candidate.latitude,
        candidate.longitude,
      );
      if (distance <= matchingConfig.venueCoordinateRadiusKm) {
        pushSignal(
          signals,
          'coordinates',
          matchingConfig.scores.titleDateCoordinates,
          0.85,
          `Coordinates within ${distance.toFixed(2)} km.`,
        );
      }
    }

    if (incoming.ticketUrl && candidate.ticketUrl && incoming.ticketUrl === candidate.ticketUrl) {
      pushSignal(signals, 'ticket_url', 95, 0.9, 'Ticket URLs match.');
    }

    const incomingUrl = incoming.eventUrl ?? incoming.originalLink;
    if (incomingUrl && candidate.eventUrl && incomingUrl === candidate.eventUrl) {
      pushSignal(signals, 'event_url', 90, 0.85, 'Event URLs match.');
    }

    const incomingArtists = incoming.artistNames ?? [];
    const candidateArtists = candidate.artistNames ?? [];
    const hasStrongSignal = signals.some((signal) =>
      ['source_reference', 'fingerprint', 'external_id', 'ticket_url', 'event_url', 'venue', 'coordinates'].includes(
        signal.type,
      ),
    );
    if (hasStrongSignal && incomingArtists.length > 0 && candidateArtists.length > 0) {
      let bestArtistScore = 0;
      for (const artist of incomingArtists) {
        for (const candidateArtist of candidateArtists) {
          bestArtistScore = Math.max(bestArtistScore, tokenSimilarity(artist, candidateArtist));
        }
      }
      if (bestArtistScore >= 85) {
        pushSignal(
          signals,
          'artist_overlap',
          Math.min(40, bestArtistScore / 2),
          0.25,
          `Artist overlap support score ${bestArtistScore}.`,
        );
      }
    }

    const duplicateOutcome = this.duplicateDetector.detect(
      {
        externalId: incoming.externalId,
        title: incoming.title,
        startDate: incoming.startDate,
        venueName: incoming.venueName,
        cityName: incoming.cityName,
        latitude: incoming.latitude,
        longitude: incoming.longitude,
        artistNames: incoming.artistNames,
        ticketUrl: incoming.ticketUrl,
        eventUrl: incoming.eventUrl ?? incoming.originalLink,
        rawSourceType: incoming.rawSourceType,
      },
      {
        cities: [],
        venues: [],
        organizers: [],
        artists: [],
        genres: [],
        events: [candidate],
      },
      input.matchedVenueId,
      input.matchedArtistIds,
    );

    if (duplicateOutcome.duplicateScore > 0) {
      pushSignal(
        signals,
        'title_similarity',
        duplicateOutcome.duplicateScore,
        0.85,
        `Duplicate detector score ${duplicateOutcome.duplicateScore}.`,
      );
    }

    return {
      confidenceScore: Math.min(100, weightedAverage(signals)),
      signals,
    };
  }

  buildFingerprintSnapshot(event: CanonicalImportEvent): Record<string, string> {
    const fingerprints = buildEventIdentityFingerprint(event);
    return {
      canonical: fingerprints.canonicalFingerprint,
      title: fingerprints.titleFingerprint,
      venue: fingerprints.venueFingerprint ?? '',
      date: fingerprints.dateFingerprint,
      organizer: fingerprints.organizerFingerprint ?? '',
      location: fingerprints.normalizedLocation ?? '',
    };
  }
}

export const multiSourceMatchScorer = new MultiSourceMatchScorer();
