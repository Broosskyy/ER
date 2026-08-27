import { STADTGARTEN_HOST, STADTGARTEN_LIST_URL } from './constants';

const LIST_PATH_PATTERN = /^\/programm(?:\/year:\d{4}\/month:\d{2})?\/?$/i;
const DETAIL_PATH_PATTERN = /^\/programm\/([a-z0-9-]+)-(\d+)\/?$/i;

export function canonicalizeStadtgartenUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, STADTGARTEN_LIST_URL);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:' && parsed.hostname === STADTGARTEN_HOST) {
    parsed = new URL(parsed.toString().replace(/^http:/i, 'https:'));
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== STADTGARTEN_HOST) {
    return null;
  }

  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `https://${STADTGARTEN_HOST}${pathname}`;
}

export function isStadtgartenListUrl(url: string): boolean {
  const canonical = canonicalizeStadtgartenUrl(url);
  if (!canonical) {
    return false;
  }
  return LIST_PATH_PATTERN.test(new URL(canonical).pathname);
}

export function isStadtgartenDetailUrl(url: string): boolean {
  const canonical = canonicalizeStadtgartenUrl(url);
  if (!canonical) {
    return false;
  }
  return DETAIL_PATH_PATTERN.test(new URL(canonical).pathname);
}

export function extractStadtgartenEventId(url: string): string | null {
  const canonical = canonicalizeStadtgartenUrl(url);
  if (!canonical) {
    return null;
  }
  const match = new URL(canonical).pathname.match(DETAIL_PATH_PATTERN);
  return match?.[2] ?? null;
}

export function buildStadtgartenDetailUrl(slug: string, eventId: string): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedId = eventId.trim();
  if (!normalizedSlug || !/^\d+$/.test(normalizedId)) {
    return null;
  }
  return `https://${STADTGARTEN_HOST}/programm/${normalizedSlug}-${normalizedId}/`;
}

export function resolveStadtgartenRedirectUrl(
  currentUrl: string,
  locationHeader: string | null,
): string | null {
  if (!locationHeader) {
    return null;
  }
  const resolved = new URL(locationHeader, currentUrl);
  if (resolved.protocol === 'http:' && resolved.hostname === STADTGARTEN_HOST) {
    resolved.protocol = 'https:';
  }
  return canonicalizeStadtgartenUrl(resolved.toString());
}
