import { RAUSGEGANGEN_BASE_URL } from './constants';

export function extractEventSlugFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, RAUSGEGANGEN_BASE_URL);
    const match = parsed.pathname.match(/^\/events\/([^/]+)\/?$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function normalizeRausgegangenEventUrl(url: string): string | null {
  const slug = extractEventSlugFromUrl(url);
  if (!slug) {
    return null;
  }
  return `${RAUSGEGANGEN_BASE_URL}/events/${slug}/`;
}

export function normalizeRausgegangenRegionUrl(slug: string): string {
  const clean = slug.replace(/^\/+|\/+$/g, '').toLowerCase();
  return `${RAUSGEGANGEN_BASE_URL}/${clean}/`;
}

export function extractRegionSlugFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, RAUSGEGANGEN_BASE_URL);
    const match = parsed.pathname.match(/^\/([a-z0-9-]+)\/?$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function titleFromEventSlug(slug: string): string {
  return slug
    .replace(/-\d+$/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => (/^(b2b|dj|live)$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export function buildRausgegangenIdentityKey(eventSlug: string): string {
  return `rausgegangen:${eventSlug.toLowerCase()}`;
}

export function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
