import type { DiscoverySearchLocale } from '../domain/discovery-search-types';

const DIACRITIC_PATTERN = /[\u0300-\u036f]/g;

export function normalizeDiscoverySearchText(
  value: string,
  locale: DiscoverySearchLocale = 'de',
): string {
  return value
    .trim()
    .toLocaleLowerCase(locale)
    .normalize('NFD')
    .replace(DIACRITIC_PATTERN, '')
    .replace(/ß/g, 'ss');
}

export function tokenizeDiscoverySearchText(
  value: string,
  locale: DiscoverySearchLocale = 'de',
): string[] {
  const normalized = normalizeDiscoverySearchText(value, locale);
  if (!normalized) {
    return [];
  }
  return normalized.split(/\s+/).filter(Boolean);
}

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const matrix: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let row = 0; row <= left.length; row += 1) {
    matrix[row]![0] = row;
  }
  for (let col = 0; col <= right.length; col += 1) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row]![col] = Math.min(
        matrix[row - 1]![col]! + 1,
        matrix[row]![col - 1]! + 1,
        matrix[row - 1]![col - 1]! + cost,
      );
    }
  }

  return matrix[left.length]![right.length]!;
}

export function isFuzzyMatch(
  term: string,
  candidate: string,
  threshold = 2,
): boolean {
  if (candidate.includes(term)) {
    return true;
  }
  if (term.length < 3 || candidate.length < 3) {
    return false;
  }
  return levenshteinDistance(term, candidate) <= threshold;
}
