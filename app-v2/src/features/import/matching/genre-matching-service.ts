import { GENRE_SYNONYMS, matchingConfig } from '@/features/import/matching/matching-config';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { expandAliases, normalizeMatchText, slugifyMatchText, tokenSimilarity } from '@/features/import/matching/matching-utils';

export interface GenreMatchOutcome {
  genreId?: string;
  genreName: string;
  confidenceScore: number;
  matchType: 'exact' | 'probable' | 'none';
}

export class GenreMatchingService {
  match(candidate: NormalizedEventCandidate, catalog: MatchingCatalog): GenreMatchOutcome[] {
    const names = candidate.genreNames ?? [];
    const results: GenreMatchOutcome[] = [];

    for (const inputName of names) {
      let best: GenreMatchOutcome = {
        genreName: inputName,
        confidenceScore: 0,
        matchType: 'none',
      };

      const normalizedInput = normalizeMatchText(inputName.replace(/-/g, ' '));

      for (const genre of catalog.genres) {
        const synonyms = [
          normalizeMatchText(genre.name),
          slugifyMatchText(genre.name),
          ...(genre.slug ? expandAliases(genre.slug, GENRE_SYNONYMS) : []),
          ...(GENRE_SYNONYMS[genre.slug ?? slugifyMatchText(genre.name)] ?? []).map(normalizeMatchText),
          ...(genre.aliases ?? []).map(normalizeMatchText),
        ];

        let score = tokenSimilarity(inputName, genre.name);
        if (synonyms.includes(normalizedInput)) {
          score = 100;
        } else {
          for (const synonym of synonyms) {
            score = Math.max(score, tokenSimilarity(inputName, synonym));
          }
        }

        if (score > best.confidenceScore) {
          best = {
            genreId: score >= matchingConfig.minGenreConfidence ? genre.id : undefined,
            genreName: inputName,
            confidenceScore: score,
            matchType:
              score >= matchingConfig.minGenreConfidence
                ? score >= 95
                  ? 'exact'
                  : 'probable'
                : 'none',
          };
        }
      }

      results.push(best);
    }

    return results;
  }
}

export const genreMatchingService = new GenreMatchingService();
