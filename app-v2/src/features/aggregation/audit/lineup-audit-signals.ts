import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import {
  isLineupBlobArtistName,
  isLineupPlaceholderArtist,
} from '@/features/events/domain/lineup-artist-quality';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

import type { InvalidArtistSignal, TitleInferenceClass } from './lineup-audit-types';

const HTML_ENTITY_PATTERN = /&(?:ldquo|rdquo|bdquo|eacute|amp|quot|nbsp|#\d+);/i;
const HTML_TAG_PATTERN = /<[^>]+>/;
const URL_PATTERN = /https?:\/\/|www\.\w+/i;
const SENTENCE_PATTERN = /[.!?…]\s|\.{3,}/;
const AMENITY_PATTERN =
  /\b(?:massageservice|massage|lounge|raucher|verkleide|artwork\s+by|walking\s+acts|currywurst|pizza\s+deluxe)\b/i;
const ADMISSION_PATTERN = /\b(?:einlass|admission|ab\s+\d+\s+jahren|doors?\s+\d|uhr)\b/i;

const TITLE_INFERENCE_MARKERS =
  /\b(?:presents?|pres\.?|pres\s+by|edition|weekender|festival|party|club\s+night|special|hosted\s+by)\b/i;

export function detectInvalidArtistSignals(name: string): InvalidArtistSignal[] {
  const trimmed = name.trim();
  if (!trimmed) {
    return ['placeholder_not_rejected'];
  }

  const signals: InvalidArtistSignal[] = [];
  if (HTML_ENTITY_PATTERN.test(trimmed)) {
    signals.push('html_entity');
  }
  if (HTML_TAG_PATTERN.test(trimmed)) {
    signals.push('html_tag');
  }
  if (URL_PATTERN.test(trimmed)) {
    signals.push('url');
  }
  if (isLineupBlobArtistName(trimmed) && trimmed.length > 80) {
    signals.push('excessive_length');
  }
  if (SENTENCE_PATTERN.test(trimmed) || trimmed.split(/\s+/).length > 12) {
    signals.push('prose_sentence');
  }
  if (AMENITY_PATTERN.test(trimmed)) {
    signals.push('amenity');
  }
  if (ADMISSION_PATTERN.test(trimmed)) {
    signals.push('ticket_admission');
  }
  if (/\b(?:bootshaus|kitkat(?:\s*club)?|venue|organizer|organiser)\b/i.test(trimmed) && trimmed.length > 40) {
    signals.push('venue_organizer_text');
  }
  if (/\bdefiniert sich\b|\bund greift die\b/i.test(trimmed)) {
    signals.push('prose_sentence');
  }
  if (isCollapsedLineupArtistName(trimmed)) {
    signals.push('collapsed_boundary');
  }
  if (!isLineupPlaceholderArtist(trimmed) && signals.length > 0) {
    signals.push('placeholder_not_rejected');
  }
  return [...new Set(signals)];
}

export function isSuspiciousArtistName(name: string): boolean {
  return detectInvalidArtistSignals(name).length > 0;
}

export function classifyTitleInference(
  eventTitle: string,
  artistName: string,
): TitleInferenceClass {
  const titleArtists = extractArtistsFromEventTitle(eventTitle) ?? [];
  const normalizedArtist = normalizeMatchText(artistName);
  const normalizedTitle = normalizeMatchText(eventTitle);

  if (titleArtists.some((candidate) => normalizeMatchText(candidate) === normalizedArtist)) {
    if (titleArtists.length === 1 && normalizedArtist === normalizedTitle) {
      return 'event_brand_mistaken';
    }
    if (TITLE_INFERENCE_MARKERS.test(eventTitle) && titleArtists.length <= 1) {
      return 'series_name_mistaken';
    }
    if (/\b(?:bootshaus|kitkat|venue)\b/i.test(artistName)) {
      return 'venue_organizer_mistaken';
    }
    return titleArtists.length > 1 ? 'valid_title_lineup' : 'valid_solo_billing';
  }

  if (normalizedTitle.includes(normalizedArtist) || normalizedArtist.includes(normalizedTitle)) {
    return 'invalid_title_fragment';
  }

  return 'partial_inference_only';
}

export function lineupOverlapRatio(left: string[], right: string[]): number {
  const setLeft = new Set(left.map((name) => normalizeMatchText(name)));
  const setRight = new Set(right.map((name) => normalizeMatchText(name)));
  if (setLeft.size === 0 || setRight.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const name of setLeft) {
    if (setRight.has(name)) {
      intersection += 1;
    }
  }
  return intersection / Math.min(setLeft.size, setRight.size);
}

export function lineupFingerprint(artistNames: string[]): string {
  return artistNames.map((name) => normalizeMatchText(name)).sort().join('|');
}

export function structuredLineupFingerprint(
  entries: Array<{ billingRelation: string; artists: string[] }>,
): string {
  return entries
    .map(
      (entry) =>
        `${entry.billingRelation}:${entry.artists.map((name) => normalizeMatchText(name)).join('+')}`,
    )
    .join('||');
}
