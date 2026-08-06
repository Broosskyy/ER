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

export function sameCalendarDay(left: string, right: string): boolean {
  const l = new Date(left);
  const r = new Date(right);
  if (Number.isNaN(l.getTime()) || Number.isNaN(r.getTime())) return false;
  return (
    l.getUTCFullYear() === r.getUTCFullYear() &&
    l.getUTCMonth() === r.getUTCMonth() &&
    l.getUTCDate() === r.getUTCDate()
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
