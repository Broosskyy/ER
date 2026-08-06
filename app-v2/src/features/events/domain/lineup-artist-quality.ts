import { filterArtistCandidatesThroughGate } from '@/features/events/domain/artist-candidate-quality-gate';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import {
  expandSegmentedLineupNames,
  isCollapsedLineupArtistName,
} from '@/features/aggregation/domain/lineup-billing-parser';

/** Section labels and placeholders that must never become lineup artists. */
const LINEUP_PLACEHOLDER_ARTISTS = new Set([
  'unbekannt',
  'unknown',
  'tba',
  'tbd',
  'n/a',
  'na',
  'none',
  'null',
  'various',
  'various artists',
  'diverse',
  'organization',
  'organizer',
  'organisers',
  'artists',
  'artist',
  'line-up',
  'lineup',
  'line up',
  'line-up artists',
  'support',
  'special guests',
  'special guest',
  'guests',
  'headliner',
  'headliners',
  'line up',
  'dj',
  'djs',
  'live',
  'location',
  'information',
  'floors',
  'floor',
  'genre',
  'genres',
  'acts',
  'act',
  'info',
  'tickets',
  'ticket',
]);

/** Names too long or structurally page/footer blobs must never become catalog artists. */
export const MAX_LINEUP_ARTIST_NAME_LENGTH = 120;

const LINEUP_BLOB_PATTERNS = [
  /einlass\s+ab\s+\d+\s+jahren/i,
  /age\s+for\s+admission/i,
  /bootshaus-mobile-app/i,
  /bit\.ly\//i,
  /ticketkings\.de/i,
  /zum\s+inhalt\s+springen/i,
  /public\s+transport\s+tickets\s+included/i,
  /▔{3,}/,
  /https?:\/\//i,
  /www\.[a-z0-9.-]+\//i,
];

export function isLineupBlobArtistName(value: string | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_LINEUP_ARTIST_NAME_LENGTH) {
    return true;
  }
  if (LINEUP_BLOB_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount > 24;
}

export function isLineupPlaceholderArtist(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }
  if (isLineupBlobArtistName(value)) {
    return true;
  }
  if (isCollapsedLineupArtistName(value)) {
    return true;
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (LINEUP_PLACEHOLDER_ARTISTS.has(normalized)) {
    return true;
  }
  if (/^(line[\s-]?up|artists?|organization|organiser|support|special guests?)\s*:?\s*$/i.test(normalized)) {
    return true;
  }
  if (/\bxxx\s+edition\b/i.test(normalized)) {
    return true;
  }
  if (/^by\s+/i.test(value.trim())) {
    return true;
  }
  return false;
}

export function sanitizeLineupArtistNames(names: string[] | undefined): string[] | undefined {
  if (!names?.length) {
    return undefined;
  }
  const expanded = expandSegmentedLineupNames(names);
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const name of expanded) {
    const trimmed = name.trim();
    if (!trimmed || isLineupPlaceholderArtist(trimmed)) {
      continue;
    }
    const key = normalizeMatchText(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(trimmed);
  }
  const gated = filterArtistCandidatesThroughGate(cleaned, { sourceField: 'lineup' });
  return gated.length > 0 ? gated : undefined;
}

export { isCollapsedLineupArtistName };

function unionArtistNames(current: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of [...current, ...incoming]) {
    const trimmed = name.trim();
    if (!trimmed || isLineupPlaceholderArtist(trimmed)) {
      continue;
    }
    const key = normalizeMatchText(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Prefer richer lineups; never return a smaller set when union is larger.
 */
export function pickBetterArtistNames(
  current: string[] | undefined,
  incoming: string[] | undefined,
): string[] | undefined {
  const sanitizedCurrent = sanitizeLineupArtistNames(current) ?? [];
  const sanitizedIncoming = sanitizeLineupArtistNames(incoming) ?? [];

  if (sanitizedIncoming.length === 0) {
    return sanitizedCurrent.length > 0 ? sanitizedCurrent : undefined;
  }
  if (sanitizedCurrent.length === 0) {
    return sanitizedIncoming;
  }

  if (sanitizedIncoming.length > sanitizedCurrent.length) {
    return sanitizedIncoming;
  }
  if (sanitizedIncoming.length < sanitizedCurrent.length) {
    return sanitizedCurrent;
  }

  const merged = unionArtistNames(sanitizedCurrent, sanitizedIncoming);
  return merged.length > 0 ? merged : undefined;
}

export function unionArtistIdLists(existingIds: string[], incomingIds: string[]): string[] {
  const result = [...existingIds];
  for (const id of incomingIds) {
    if (id && !result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}
