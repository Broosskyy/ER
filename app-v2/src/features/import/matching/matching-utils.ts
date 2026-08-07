export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function slugifyMatchText(value: string): string {
  return normalizeMatchText(value).replace(/\s+/g, '-');
}

/** Keep artist primary keys index-safe (B-tree composite indexes include entry_id + artist_id). */
export const MAX_ARTIST_ID_SLUG_LENGTH = 96;

export function capArtistIdSlug(slug: string, maxLength = MAX_ARTIST_ID_SLUG_LENGTH): string {
  const trimmed = slug.replace(/^-+|-+$/g, '');
  if (trimmed.length <= maxLength) {
    return trimmed || 'artist';
  }
  const suffix = trimmed.slice(-8);
  return `${trimmed.slice(0, maxLength - 9)}-${suffix}`;
}

export function tokenSimilarity(left: string, right: string): number {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b) return 0;
  if (a === b) return 100;

  const aTokens = new Set(a.split(' '));
  const bTokens = new Set(b.split(' '));
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return Math.round((intersection / union) * 100);
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function extractPostalCode(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/\b\d{5}\b/);
  return match?.[0];
}

export interface EventCalendarDay {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Parses the local event calendar day from an ISO date or date-time string.
 * Uses the literal Y-M-D when an offset is present — no UTC shift of the visible event day.
 */
export function parseEventCalendarDay(value: string): EventCalendarDay | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = trimmed.match(ISO_DATE_ONLY);
  if (dateOnly) {
    return {
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    };
  }

  const iso = trimmed.match(ISO_DATE_TIME);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

/** True when both values refer to the same local event calendar day (time-of-day ignored). */
export function sameCalendarDay(left: string, right: string): boolean {
  const l = parseEventCalendarDay(left);
  const r = parseEventCalendarDay(right);
  if (!l || !r) {
    return false;
  }
  return l.year === r.year && l.month === r.month && l.day === r.day;
}

const ISO_TIME_PART =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

/** Non-critical hint: same event day but different clock times were declared. */
export function eventDatesNeedTimeOfDayReview(left: string, right: string): boolean {
  if (!sameCalendarDay(left, right)) {
    return false;
  }
  const leftTime = left.trim().match(ISO_TIME_PART);
  const rightTime = right.trim().match(ISO_TIME_PART);
  if (!leftTime || !rightTime) {
    return false;
  }
  return (
    leftTime[4] !== rightTime[4] ||
    leftTime[5] !== rightTime[5] ||
    (leftTime[6] ?? '00') !== (rightTime[6] ?? '00')
  );
}

export function expandAliases(
  canonical: string,
  aliasMap: Record<string, string[]>,
): string[] {
  const normalized = slugifyMatchText(canonical);
  const aliases = aliasMap[normalized] ?? [];
  return [canonical, normalized, ...aliases.map(normalizeMatchText)];
}
