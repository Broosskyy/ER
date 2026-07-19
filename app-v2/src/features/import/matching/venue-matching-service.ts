import { matchingConfig } from '@/features/import/matching/matching-config';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import {
  haversineKm,
  normalizeMatchText,
  tokenSimilarity,
} from '@/features/import/matching/matching-utils';

export interface VenueMatchOutcome {
  venueId?: string;
  confidenceScore: number;
  matchType: 'exact' | 'probable' | 'none';
  warning?: string;
}

export class VenueMatchingService {
  match(
    candidate: NormalizedEventCandidate,
    catalog: MatchingCatalog,
    matchedCityId?: string,
  ): VenueMatchOutcome {
    if (!candidate.venueName) {
      return { confidenceScore: 0, matchType: 'none', warning: 'No venue name provided.' };
    }

    let best: VenueMatchOutcome = { confidenceScore: 0, matchType: 'none' };

    for (const venue of catalog.venues) {
      if (matchedCityId && venue.cityId !== matchedCityId) {
        continue;
      }

      let score = tokenSimilarity(candidate.venueName, venue.name);
      if (candidate.venueAddress && venue.address) {
        score = Math.round(score * 0.6 + tokenSimilarity(candidate.venueAddress, venue.address) * 0.4);
      }

      if (
        candidate.latitude !== undefined &&
        candidate.longitude !== undefined &&
        venue.latitude !== undefined &&
        venue.longitude !== undefined
      ) {
        const distance = haversineKm(
          candidate.latitude,
          candidate.longitude,
          venue.latitude,
          venue.longitude,
        );
        if (distance <= matchingConfig.venueCoordinateRadiusKm) {
          score = Math.min(100, score + 25);
        }
      }

      if (score > best.confidenceScore) {
        best = {
          venueId: venue.id,
          confidenceScore: score,
          matchType:
            score >= matchingConfig.minVenueConfidence
              ? score >= 95
                ? 'exact'
                : 'probable'
              : 'none',
        };
      }
    }

    if (best.matchType === 'none') {
      return {
        ...best,
        warning: `No venue match found for "${candidate.venueName}".`,
      };
    }

    if (best.matchType === 'probable') {
      return {
        ...best,
        warning: `Probable venue match for "${candidate.venueName}" (${best.confidenceScore}%).`,
      };
    }

    return best;
  }
}

export const venueMatchingService = new VenueMatchingService();
