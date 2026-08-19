import { normalizedGenresToExplicitLabels, normalizeOfficialGenreLabels } from './normalize-genre';

const DESCRIPTION_GENRE_SPANNING_PATTERN =
  /\b(?:spanning|including|featuring|covering|across)\s+([^.!\n]+?)(?:\s+in all its forms)?[.!\n]/i;

export function parseDescriptionExplicitGenres(description: string | undefined): string[] {
  if (!description) {
    return [];
  }

  const spanningMatch = description.match(DESCRIPTION_GENRE_SPANNING_PATTERN);
  if (!spanningMatch?.[1]) {
    return [];
  }

  const labels = spanningMatch[1]
    .split(/\s*,\s*|\s+and\s+/i)
    .map((label) => label.replace(/\s+in all its forms\.?$/i, '').replace(/[.!]+$/, '').trim())
    .filter((label) => label.length > 0 && !/^once$/i.test(label));

  const { normalized } = normalizeOfficialGenreLabels(labels);
  return normalizedGenresToExplicitLabels(normalized);
}
