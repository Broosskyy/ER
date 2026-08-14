import { BOOTSHAUS_HOST, BOOTSHAUS_LIST_URL } from './constants';

const DETAIL_PATH_PATTERN = /^\/events\/([a-z0-9][a-z0-9-]*)\/?$/i;

export function canonicalizeBootshausUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, BOOTSHAUS_LIST_URL);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:' && parsed.hostname === BOOTSHAUS_HOST) {
    parsed = new URL(parsed.toString().replace(/^http:/i, 'https:'));
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  if (parsed.hostname !== BOOTSHAUS_HOST) {
    return null;
  }

  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `https://${BOOTSHAUS_HOST}${pathname}`;
}

export function isBootshausListUrl(url: string): boolean {
  const canonical = canonicalizeBootshausUrl(url);
  return canonical === BOOTSHAUS_LIST_URL;
}

export function isBootshausDetailUrl(url: string): boolean {
  const canonical = canonicalizeBootshausUrl(url);
  if (!canonical) {
    return false;
  }

  const pathname = new URL(canonical).pathname;
  return DETAIL_PATH_PATTERN.test(pathname) && pathname !== '/events/';
}

export function extractBootshausDetailSlug(url: string): string | null {
  const canonical = canonicalizeBootshausUrl(url);
  if (!canonical) {
    return null;
  }

  const match = new URL(canonical).pathname.match(DETAIL_PATH_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

export function buildBootshausDetailUrl(slug: string): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalizedSlug)) {
    return null;
  }

  return `https://${BOOTSHAUS_HOST}/events/${normalizedSlug}/`;
}

export function resolveBootshausRedirectUrl(
  currentUrl: string,
  locationHeader: string | null,
): string | null {
  if (!locationHeader) {
    return null;
  }

  const resolved = new URL(locationHeader, currentUrl);
  if (resolved.protocol === 'http:' && resolved.hostname === BOOTSHAUS_HOST) {
    resolved.protocol = 'https:';
  }

  return canonicalizeBootshausUrl(resolved.toString());
}
