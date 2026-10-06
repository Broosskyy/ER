import {
  normalizedGenresToExplicitLabels,
  normalizeOfficialGenreLabels,
  type NormalizedGenreLabel,
} from './normalize-genre';
import { parseDescriptionExplicitGenres } from '../shared/parse-description-genres';

export { parseDescriptionExplicitGenres };

export function parseBootshausExplicitGenres(genresHtml: string): string[] {
  const labels = [...genresHtml.matchAll(/<[^>]+class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/[^>]+>/gi)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);

  if (labels.length > 0) {
    const { normalized } = normalizeOfficialGenreLabels(labels);
    return normalizedGenresToExplicitLabels(normalized);
  }

  const text = genresHtml
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== 'genres');

  const { normalized } = normalizeOfficialGenreLabels(text);
  return normalizedGenresToExplicitLabels(normalized);
}

export function parseBootshausGenreEvidence(genresHtml: string): {
  explicitGenreLabels: string[];
  normalizedGenres: NormalizedGenreLabel[];
  unmappedGenreLabels: NormalizedGenreLabel[];
} {
  const labels = [...genresHtml.matchAll(/<[^>]+class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/[^>]+>/gi)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);

  const rawLabels =
    labels.length > 0
      ? labels
      : genresHtml
          .replace(/<[^>]+>/g, '\n')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.toLowerCase() !== 'genres');

  const { normalized, unmapped } = normalizeOfficialGenreLabels(rawLabels);
  return {
    explicitGenreLabels: normalizedGenresToExplicitLabels(normalized),
    normalizedGenres: normalized,
    unmappedGenreLabels: unmapped,
  };
}
