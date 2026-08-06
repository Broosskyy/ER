import type {
  CanonicalLineupEntry,
  LineupEntryProvenance,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  dedupeCanonicalLineupEntries,
  parseLineupLineToCanonicalEntries,
} from '@/features/aggregation/domain/lineup-entry-builder';
import { splitLineupTextIntoLines } from '@/features/aggregation/domain/lineup-billing-parser';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

const FLYER_NOISE_PATTERN =
  /\b(?:line[\s-]?up|artists?|presents?|edition|floor|stage|organization|sponsor|mystery|unknown|tba|tbd|tickets?|einlass|doors|ab\s+\d|uhr|pm|am|€|eur|years?|jahre?|instagram|facebook|soundcloud|www\.|http)\b/i;

function isSkippableFlyerLine(
  line: string,
  options?: { eventTitle?: string; venueName?: string; cityName?: string },
): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (/\b(?:b2b|f2f|vs\.?)\b/i.test(trimmed)) {
    return false;
  }
  if (isLineupPlaceholderArtist(trimmed) || FLYER_NOISE_PATTERN.test(trimmed)) {
    return true;
  }
  const normalized = normalizeMatchText(trimmed);
  if (options?.eventTitle && normalizeMatchText(options.eventTitle) === normalized) {
    return true;
  }
  if (options?.venueName && normalizeMatchText(options.venueName) === normalized) {
    return true;
  }
  if (options?.cityName && normalizeMatchText(options.cityName) === normalized) {
    return true;
  }
  return false;
}

/** Parse official flyer text into canonical structured entries without flattening billing. */
export function parseFlyerTextToCanonicalEntries(
  rawText: string,
  options?: {
    provenance?: LineupEntryProvenance;
    confidence?: number;
    eventTitle?: string;
    venueName?: string;
    cityName?: string;
  },
): CanonicalLineupEntry[] {
  const lines = splitLineupTextIntoLines(rawText);
  const entries: CanonicalLineupEntry[] = [];
  let order = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isSkippableFlyerLine(line, options)) {
      continue;
    }
    const parsed = parseLineupLineToCanonicalEntries(line, {
      orderOffset: order,
      provenance: options?.provenance,
      confidence: options?.confidence ?? 0.9,
    });
    for (const entry of parsed) {
      const artists = entry.artists
        .map((name) => name.trim())
        .filter((name) => name && !isLineupPlaceholderArtist(name));
      if (artists.length === 0) {
        continue;
      }
      entries.push({ ...entry, artists, order });
      order += 1;
    }
  }

  return dedupeCanonicalLineupEntries(entries);
}
