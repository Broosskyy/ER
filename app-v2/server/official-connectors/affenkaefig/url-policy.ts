import { AFFENKAEFIG_HOST, AFFENKAEFIG_LIST_URL } from './constants';

const DETAIL_PATH_PATTERN = /^\/event\/([a-z0-9][a-z0-9-]*)\/?$/i;
const LIST_PATH_PATTERN = /^\/tickets\/?$/i;
const SHORTLINK_PATH_PATTERN = /^\/$/i;
const SHORTLINK_QUERY_PATTERN = /^p=\d+$/i;

export function canonicalizeAffenkaefigUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, AFFENKAEFIG_LIST_URL);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:' && parsed.hostname === AFFENKAEFIG_HOST) {
    parsed = new URL(parsed.toString().replace(/^http:/i, 'https:'));
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== AFFENKAEFIG_HOST) {
    return null;
  }

  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  const query = parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search;
  if (SHORTLINK_PATH_PATTERN.test(pathname) && SHORTLINK_QUERY_PATTERN.test(query)) {
    return `https://${AFFENKAEFIG_HOST}/?${query}`;
  }
  return `https://${AFFENKAEFIG_HOST}${pathname}`;
}

export function isAffenkaefigListUrl(url: string): boolean {
  const canonical = canonicalizeAffenkaefigUrl(url);
  if (!canonical) {
    return false;
  }
  return LIST_PATH_PATTERN.test(new URL(canonical).pathname);
}

export function isAffenkaefigShortlinkUrl(url: string): boolean {
  const canonical = canonicalizeAffenkaefigUrl(url);
  if (!canonical) {
    return false;
  }
  const parsed = new URL(canonical);
  if (!SHORTLINK_PATH_PATTERN.test(parsed.pathname)) {
    return false;
  }
  const query = parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search;
  return SHORTLINK_QUERY_PATTERN.test(query);
}

export function isAffenkaefigDetailUrl(url: string): boolean {
  const canonical = canonicalizeAffenkaefigUrl(url);
  if (!canonical) {
    return false;
  }
  return DETAIL_PATH_PATTERN.test(new URL(canonical).pathname);
}

export function extractAffenkaefigDetailSlug(url: string): string | null {
  const canonical = canonicalizeAffenkaefigUrl(url);
  if (!canonical) {
    return null;
  }
  const match = new URL(canonical).pathname.match(DETAIL_PATH_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

export function buildAffenkaefigDetailUrl(slug: string): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalizedSlug)) {
    return null;
  }
  return `https://${AFFENKAEFIG_HOST}/event/${normalizedSlug}/`;
}

export function resolveAffenkaefigRedirectUrl(
  currentUrl: string,
  locationHeader: string | null,
): string | null {
  if (!locationHeader) {
    return null;
  }
  const resolved = new URL(locationHeader, currentUrl);
  if (resolved.protocol === 'http:' && resolved.hostname === AFFENKAEFIG_HOST) {
    resolved.protocol = 'https:';
  }
  const canonical = canonicalizeAffenkaefigUrl(resolved.toString());
  if (!canonical) {
    return null;
  }
  if (isAffenkaefigDetailUrl(currentUrl) && !isAffenkaefigDetailUrl(canonical)) {
    return null;
  }
  return canonical;
}
