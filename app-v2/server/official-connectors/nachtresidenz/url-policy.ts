import { NACHTRESIDENZ_HOST, NACHTRESIDENZ_LIST_URL } from './constants';

const LIST_PATH_PATTERN = /^\/events\/?$/i;
const EVENT_PATH_PATTERN =
  /^\/events\/event\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\/([a-z0-9][a-z0-9-]*)\/?$/i;

export function canonicalizeNachtresidenzUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, NACHTRESIDENZ_LIST_URL);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:' && parsed.hostname === NACHTRESIDENZ_HOST) {
    parsed = new URL(parsed.toString().replace(/^http:/i, 'https:'));
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== NACHTRESIDENZ_HOST) {
    return null;
  }

  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `https://${NACHTRESIDENZ_HOST}${pathname}`;
}

export function isNachtresidenzListUrl(url: string): boolean {
  const canonical = canonicalizeNachtresidenzUrl(url);
  if (!canonical) {
    return false;
  }
  return LIST_PATH_PATTERN.test(new URL(canonical).pathname);
}

export function isNachtresidenzEventUrl(url: string): boolean {
  const canonical = canonicalizeNachtresidenzUrl(url);
  if (!canonical) {
    return false;
  }
  return EVENT_PATH_PATTERN.test(new URL(canonical).pathname);
}

export function slugifyNachtresidenzTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function normalizeDatetimeForPath(datetimeAttr: string): string {
  return datetimeAttr.trim().replace(' ', 'T').replace(/:/g, '-');
}

export function buildNachtresidenzEventUrl(datetimeAttr: string, title: string): string | null {
  const slug = slugifyNachtresidenzTitle(title);
  if (!slug) {
    return null;
  }
  const normalizedDatetime = normalizeDatetimeForPath(datetimeAttr);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(normalizedDatetime)) {
    return null;
  }
  return `https://${NACHTRESIDENZ_HOST}/events/event/${normalizedDatetime}/${slug}/`;
}

export function extractNachtresidenzEventKey(url: string): string | null {
  const canonical = canonicalizeNachtresidenzUrl(url);
  if (!canonical) {
    return null;
  }
  const match = new URL(canonical).pathname.match(EVENT_PATH_PATTERN);
  if (!match) {
    return null;
  }
  return `${match[1]}/${match[2]}`;
}

export function resolveNachtresidenzRedirectUrl(
  currentUrl: string,
  locationHeader: string | null,
): string | null {
  if (!locationHeader) {
    return null;
  }
  const resolved = new URL(locationHeader, currentUrl);
  if (resolved.protocol === 'http:' && resolved.hostname === NACHTRESIDENZ_HOST) {
    resolved.protocol = 'https:';
  }
  return canonicalizeNachtresidenzUrl(resolved.toString());
}
