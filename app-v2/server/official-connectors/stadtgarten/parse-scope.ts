/**
 * Scope filter based on explicit published listing/detail metadata only.
 * Does not infer genres from venue name or title keywords.
 */

const ELECTRONIC_GENRE_SIGNALS = [
  'electronica',
  'electronic',
  'elektronik',
  'elektro',
  'techno',
  'house',
  'trance',
  'ambient',
  'dancehall',
  'breakbeat',
  'breakbeats',
  'drum & bass',
  'drum and bass',
  'dnb',
  'rave',
  'hardstyle',
  'electro',
  'industrial',
  'psytrance',
  'dub techno',
  'dub house',
  'deep house',
  'synth',
  'club session',
  'dj ',
  ' dj',
] as const;

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

export function splitPublishedGenreLabels(genreText: string): string[] {
  if (!genreText.trim()) {
    return [];
  }
  return genreText
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function hasExplicitElectronicGenreSignal(genreText: string): boolean {
  const normalized = genreText.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return ELECTRONIC_GENRE_SIGNALS.some((signal) => normalized.includes(signal));
}

export function hasExplicitElectronicGenreLabels(genreLabels: readonly string[]): boolean {
  return genreLabels.some((label) => hasExplicitElectronicGenreSignal(label));
}

export function isWortFocusedEvent(categories: readonly string[], genreText: string): boolean {
  const normalizedCategories = categories.map(normalizeCategory);
  if (normalizedCategories.includes('wort') && !normalizedCategories.includes('konzert')) {
    return true;
  }

  const normalizedGenre = genreText.trim().toLowerCase();
  if (!normalizedGenre) {
    return false;
  }

  const wortSignals = /\bwort\b|\blesung\b|\bliteratur\b/;
  if (wortSignals.test(normalizedGenre) && !hasExplicitElectronicGenreSignal(normalizedGenre)) {
    return true;
  }

  return false;
}

export type StadtgartenScopeDecision = 'include' | 'outside_scope';

export function assessStadtgartenScope(
  categories: readonly string[],
  genreLabels: readonly string[],
): StadtgartenScopeDecision {
  const combinedGenreText = genreLabels.join(', ');

  if (isWortFocusedEvent(categories, combinedGenreText)) {
    return 'outside_scope';
  }

  if (hasExplicitElectronicGenreLabels(genreLabels)) {
    return 'include';
  }

  return 'outside_scope';
}
