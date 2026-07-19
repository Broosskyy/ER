import { CITY_ALIASES, matchingConfig } from '@/features/import/matching/matching-config';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import {
  expandAliases,
  extractPostalCode,
  haversineKm,
  normalizeMatchText,
  slugifyMatchText,
  tokenSimilarity,
} from '@/features/import/matching/matching-utils';

export interface CityMatchOutcome {
  cityId?: string;
  confidenceScore: number;
  matchType: 'exact' | 'probable' | 'none';
  warning?: string;
}

export class CityMatchingService {
  match(candidate: NormalizedEventCandidate, catalog: MatchingCatalog): CityMatchOutcome {
    if (!candidate.cityName && candidate.latitude === undefined) {
      return { confidenceScore: 0, matchType: 'none', warning: 'No city name or coordinates provided.' };
    }

    const postalCode = extractPostalCode(candidate.venueAddress);
    let best: CityMatchOutcome = { confidenceScore: 0, matchType: 'none' };

    for (const city of catalog.cities) {
      const aliases = expandAliases(city.slug ?? city.name, CITY_ALIASES);
      aliases.push(normalizeMatchText(city.name));
      if (city.slug) aliases.push(normalizeMatchText(city.slug));

      let score = 0;
      if (candidate.cityName) {
        const normalizedInput = normalizeMatchText(candidate.cityName);
        if (aliases.includes(normalizedInput) || aliases.includes(slugifyMatchText(candidate.cityName))) {
          score = 100;
        } else {
          score = Math.max(score, tokenSimilarity(candidate.cityName, city.name));
          for (const alias of aliases) {
            score = Math.max(score, tokenSimilarity(candidate.cityName, alias));
          }
        }
      }

      if (
        candidate.latitude !== undefined &&
        candidate.longitude !== undefined &&
        postalCode
      ) {
        // Postal code match boosts confidence when city name also aligns
        if (score >= 50) score = Math.min(100, score + 10);
      }

      if (score > best.confidenceScore) {
        best = {
          cityId: city.id,
          confidenceScore: score,
          matchType: score >= matchingConfig.minCityConfidence ? (score >= 95 ? 'exact' : 'probable') : 'none',
        };
      }
    }

    if (best.matchType === 'none') {
      return {
        ...best,
        warning: candidate.cityName
          ? `No city match found for "${candidate.cityName}".`
          : 'City could not be matched.',
      };
    }

    return best;
  }
}

export const cityMatchingService = new CityMatchingService();
