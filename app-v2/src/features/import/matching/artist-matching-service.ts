import { ARTIST_ALIASES, matchingConfig } from '@/features/import/matching/matching-config';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { expandAliases, normalizeMatchText, tokenSimilarity } from '@/features/import/matching/matching-utils';

export interface ArtistMatchOutcome {
  artistId?: string;
  artistName: string;
  confidenceScore: number;
  matchType: 'exact' | 'probable' | 'none';
}

export class ArtistMatchingService {
  match(candidate: NormalizedEventCandidate, catalog: MatchingCatalog): ArtistMatchOutcome[] {
    const names = candidate.artistNames ?? [];
    const results: ArtistMatchOutcome[] = [];

    for (const inputName of names) {
      let best: ArtistMatchOutcome = {
        artistName: inputName,
        confidenceScore: 0,
        matchType: 'none',
      };

      for (const artist of catalog.artists) {
        const aliases = [
          ...expandAliases(artist.name, ARTIST_ALIASES),
          ...(artist.aliases ?? []).map(normalizeMatchText),
        ];
        const normalizedInput = normalizeMatchText(inputName);

        let score = tokenSimilarity(inputName, artist.name);
        if (aliases.includes(normalizedInput)) {
          score = 100;
        } else {
          for (const alias of aliases) {
            score = Math.max(score, tokenSimilarity(inputName, alias));
          }
        }

        if (score > best.confidenceScore) {
          best = {
            artistId: score >= matchingConfig.minArtistConfidence ? artist.id : undefined,
            artistName: inputName,
            confidenceScore: score,
            matchType:
              score >= matchingConfig.minArtistConfidence
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

export const artistMatchingService = new ArtistMatchingService();
