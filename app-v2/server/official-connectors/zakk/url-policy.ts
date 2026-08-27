import { ZAKK_HOST, ZAKK_LIST_URL } from './constants';

const PARTY_LIST_PATH = /^\/programm\/party\/?$/i;
const DETAIL_PATH = /^\/event-detail\/?$/i;

function isZakkHost(hostname: string): boolean {
  return hostname === ZAKK_HOST || hostname === 'www.zakk.de';
}

export function canonicalizeZakkUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, ZAKK_LIST_URL);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:' && isZakkHost(parsed.hostname)) {
    parsed = new URL(parsed.toString().replace(/^http:/i, 'https:'));
  }

  if (parsed.protocol !== 'https:' || !isZakkHost(parsed.hostname)) {
    return null;
  }

  parsed.hostname = ZAKK_HOST;

  if (DETAIL_PATH.test(parsed.pathname)) {
    const eventId = parsed.searchParams.get('event');
    if (!eventId || !/^\d+$/.test(eventId)) {
      return null;
    }
    return `https://${ZAKK_HOST}/event-detail?event=${eventId}`;
  }

  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `https://${ZAKK_HOST}${pathname}`;
}

export function isZakkPartyListUrl(url: string): boolean {
  const canonical = canonicalizeZakkUrl(url);
  if (!canonical) {
    return false;
  }
  return PARTY_LIST_PATH.test(new URL(canonical).pathname);
}

export function isZakkEventDetailUrl(url: string): boolean {
  const canonical = canonicalizeZakkUrl(url);
  if (!canonical) {
    return false;
  }
  return DETAIL_PATH.test(new URL(canonical).pathname);
}

export function extractZakkEventId(url: string): string | null {
  const canonical = canonicalizeZakkUrl(url);
  if (!canonical) {
    return null;
  }
  const parsed = new URL(canonical);
  if (!DETAIL_PATH.test(parsed.pathname)) {
    return null;
  }
  const eventId = parsed.searchParams.get('event');
  return eventId && /^\d+$/.test(eventId) ? eventId : null;
}

export function buildZakkDetailUrl(eventId: string): string | null {
  const normalized = eventId.trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  return `https://${ZAKK_HOST}/event-detail?event=${normalized}`;
}

export function resolveZakkRedirectUrl(
  currentUrl: string,
  locationHeader: string | null,
): string | null {
  if (!locationHeader) {
    return null;
  }
  const resolved = new URL(locationHeader, currentUrl);
  if (resolved.protocol === 'http:' && isZakkHost(resolved.hostname)) {
    resolved.protocol = 'https:';
  }
  return canonicalizeZakkUrl(resolved.toString());
}
