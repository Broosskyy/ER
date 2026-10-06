import { canonicalGenreKey, normalizeOfficialGenreLabels } from '../../shared/normalize-genre';
import { expandGenreKeysForSearch, resolveSearchQueryToGenreKey } from '../../shared/genre-taxonomy';
import type { GenreCoverageEntry } from './genre-coverage-audit';

export interface GenreSearchRecallQuery {
  query: string;
  genreKey: string;
  expectedEventIds: string[];
  actualEventIds: string[];
  falseNegatives: string[];
  falsePositives: string[];
}

export interface GenreSearchRecallReport {
  queries: GenreSearchRecallQuery[];
  totalFalseNegatives: number;
  recoverableFalseNegatives: number;
}

function labelsToGenreKeys(labels: string[]): string[] {
  return normalizeOfficialGenreLabels(labels).normalized.map((genre) => genre.genreKey);
}

function eventMatchesGenreQuery(entry: GenreCoverageEntry, queryGenreKey: string): boolean {
  const expanded = expandGenreKeysForSearch(queryGenreKey);
  const eventKeys = new Set(
    labelsToGenreKeys([...entry.currentGenres, ...entry.recommendedGenres]),
  );
  for (const key of expanded) {
    if (eventKeys.has(key)) {
      return true;
    }
  }
  return false;
}

export function simulateGenreSearchRecall(entries: GenreCoverageEntry[]): GenreSearchRecallReport {
  const queries = ['Electronic', 'Techno', 'Hard Techno', 'Trance', 'Bounce', 'Hard Bounce', 'House', 'Tech House'];
  const results: GenreSearchRecallQuery[] = [];
  let totalFalseNegatives = 0;
  let recoverableFalseNegatives = 0;

  for (const query of queries) {
    const genreKey = resolveSearchQueryToGenreKey(query);
    if (!genreKey) {
      continue;
    }
    const expectedEventIds = entries
      .filter((entry) => entry.recommendedGenres.length > 0 && eventMatchesGenreQuery(entry, genreKey))
      .map((entry) => entry.eventId);
    const actualEventIds = entries
      .filter((entry) => entry.currentGenres.length > 0 && eventMatchesGenreQuery(entry, genreKey))
      .map((entry) => entry.eventId);

    const expectedSet = new Set(expectedEventIds);
    const actualSet = new Set(actualEventIds);
    const falseNegatives = expectedEventIds.filter((eventId) => !actualSet.has(eventId));
    const falsePositives = actualEventIds.filter((eventId) => !expectedSet.has(eventId));

    for (const eventId of falseNegatives) {
      const entry = entries.find((item) => item.eventId === eventId);
      if (entry?.classification === 'GENRE_RECOVERABLE') {
        recoverableFalseNegatives += 1;
      }
    }
    totalFalseNegatives += falseNegatives.length;

    results.push({
      query,
      genreKey,
      expectedEventIds,
      actualEventIds,
      falseNegatives,
      falsePositives,
    });
  }

  return {
    queries: results,
    totalFalseNegatives,
    recoverableFalseNegatives,
  };
}
