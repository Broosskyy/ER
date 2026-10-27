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
  'disco',
  'bounce',
  'uk garage',
  'hardgroove',
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
  'club session',
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

  // A primarily jazz/experimental seated concert is not automatically a
  // rave because its genre list also mentions ambient, electronic music or
  // synthesizers. Keep actual jazz-techno/house/trance crossover bookings
  // when the promoter explicitly names a dance-floor genre.
  const isJazzConcert = categories.some(category => normalizeCategory(category) === 'konzert') &&
    genreLabels.some(label => /\bjazz(?:[- ]?fusion)?\b/i.test(label));
  const hasExplicitDanceGenre = genreLabels.some(label =>
    /\b(?:hard[ -]?techno|techno|house|trance|psytrance|hardstyle|hardcore|gabber|rave|drum\s*(?:and|&)\s*bass|dnb|breakbeat|hardgroove|uk\s*garage|bounce)\b/i.test(label),
  );
  // Electronic/ambient art, Art-Pop and hybrid chamber music are not rave
  // concerts. "Electronica" by itself is not an event-format guarantee.
  const isConcert = categories.some(category =>
    normalizeCategory(category) === 'konzert');
  if (isConcert && !hasExplicitDanceGenre) {
    return 'outside_scope';
  }
  if (isJazzConcert && !hasExplicitDanceGenre) {
    return 'outside_scope';
  }

  // Latin dance / Cumbia / Salsa DJ nights are not automatically techno,
  // house or electronic raves because the program lists "DJ" or "dancehall".
  // An explicitly billed Techno/House/Trance crossover remains in scope.
  const latinOnly = genreLabels.some(label =>
    /\b(?:cumbia|salsa|bachata|merengue|reggaet[oó]n|latin(?:o|a)?)\b/i.test(label),
  );
  if (latinOnly && !hasExplicitDanceGenre) {
    return 'outside_scope';
  }

  if (hasExplicitElectronicGenreLabels(genreLabels)) {
    return 'include';
  }

  return 'outside_scope';
}
