import { RAUSGEGANGEN_BASE_URL } from './constants';

const LOCATION_PATH_PATTERN = /\/locations\/([a-z0-9-]+)\/?/i;

export function extractLocationSlugFromUrl(url: string): string | undefined {
  const match = url.match(LOCATION_PATH_PATTERN);
  return match?.[1]?.toLowerCase();
}

export function normalizeVenueNameToLocationSlug(venueName: string): string {
  return venueName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function inferLocationUrlFromVenueName(venueName?: string): string | undefined {
  if (!venueName?.trim()) {
    return undefined;
  }
  return normalizeLocationUrl(normalizeVenueNameToLocationSlug(venueName));
}

export function normalizeLocationUrl(slugOrUrl: string): string | undefined {
  const trimmed = slugOrUrl.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith('http')) {
    const slug = extractLocationSlugFromUrl(trimmed);
    return slug ? `${RAUSGEGANGEN_BASE_URL}/locations/${slug}/` : undefined;
  }
  const slug = trimmed.replace(/^\/+|\/+$/g, '').replace(/^locations\//i, '');
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return undefined;
  }
  return `${RAUSGEGANGEN_BASE_URL}/locations/${slug.toLowerCase()}/`;
}

const EVENT_SLUG_VENUE_PATTERNS = [
  /-(?:im|at)-([a-z0-9]+)-/i,
  /-(?:im|at)-([a-z0-9]+)$/i,
  /@-?([a-z0-9]+)-/i,
];

const MONTH_OR_DATE_SEGMENT =
  /^(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d{1,4})$/i;

const VENUE_SLUG_STOPWORDS = new Set([
  'the',
  'die',
  'der',
  'das',
  'und',
  'mit',
  'im',
  'at',
  'live',
  'open',
  'air',
  'tour',
  'party',
  'night',
  'festival',
  'club',
  'show',
  'day',
  'week',
  'weekend',
]);

function isVenueSlugCandidate(segment: string): boolean {
  const normalized = segment.toLowerCase();
  return normalized.length >= 3 && !VENUE_SLUG_STOPWORDS.has(normalized) && !/^\d+$/.test(normalized);
}

export function extractLocationSlugsFromEventSlug(eventSlug: string): string[] {
  const slugs = new Set<string>();
  for (const pattern of EVENT_SLUG_VENUE_PATTERNS) {
    for (const match of eventSlug.matchAll(new RegExp(pattern.source, 'gi'))) {
      const slug = match[1]?.toLowerCase();
      if (slug && isVenueSlugCandidate(slug)) {
        slugs.add(slug);
      }
    }
  }

  const segments = eventSlug.split('-').filter(Boolean);
  for (let index = 0; index < segments.length - 1; index += 1) {
    const next = segments[index + 1] ?? '';
    if (!MONTH_OR_DATE_SEGMENT.test(next)) {
      continue;
    }
    const candidate = segments[index]!.toLowerCase();
    if (isVenueSlugCandidate(candidate)) {
      slugs.add(candidate);
    }
  }

  return [...slugs];
}

export function extractLocationLinksFromHtml(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']*\/locations\/[a-z0-9-]+\/?)["']/gi)) {
    const normalized = normalizeLocationUrl(match[1] ?? '');
    if (normalized) {
      urls.add(normalized);
    }
  }
  return [...urls];
}
