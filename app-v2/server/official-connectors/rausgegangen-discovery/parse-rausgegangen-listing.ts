import { NON_CITY_PATHS } from './constants';
import type { RausgegangenListingEntry } from './types';
import {
  extractEventSlugFromUrl,
  normalizeRausgegangenEventUrl,
  titleFromEventSlug,
} from './rausgegangen-url';

export function extractCitySlugsFromHtml(html: string): string[] {
  const slugs = new Set<string>();
  for (const match of html.matchAll(/href=["']\/([a-z0-9-]+)\/["']/gi)) {
    const slug = match[1]?.toLowerCase();
    if (!slug || NON_CITY_PATHS.has(slug)) {
      continue;
    }
    slugs.add(slug);
  }
  return [...slugs];
}

export function parseRausgegangenCityListing(
  html: string,
  regionSlug: string,
  listingSurface: string,
): RausgegangenListingEntry[] {
  const entries: RausgegangenListingEntry[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/href=["']([^"']*\/events\/[^"']+)["']/gi)) {
    const href = match[1] ?? '';
    const normalized = normalizeRausgegangenEventUrl(href.startsWith('http') ? href : `https://rausgegangen.de${href}`);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    const slug = extractEventSlugFromUrl(normalized);
    if (!slug) {
      continue;
    }
    seen.add(normalized);
    entries.push({
      eventUrl: normalized,
      eventSlug: slug,
      regionSlug,
      listingSurface,
      listingTitleHint: titleFromEventSlug(slug),
    });
  }

  return entries;
}

export function dedupeListingEntries(entries: RausgegangenListingEntry[]): {
  unique: RausgegangenListingEntry[];
  duplicateCount: number;
} {
  const merged = new Map<string, RausgegangenListingEntry>();
  let duplicateCount = 0;

  for (const entry of entries) {
    const existing = merged.get(entry.eventUrl);
    if (existing) {
      duplicateCount += 1;
      existing.listingSurface = existing.listingSurface;
      if (!existing.listingTitleHint && entry.listingTitleHint) {
        existing.listingTitleHint = entry.listingTitleHint;
      }
      continue;
    }
    merged.set(entry.eventUrl, { ...entry, listingSurface: entry.listingSurface });
  }

  return { unique: [...merged.values()], duplicateCount };
}

export function mergeListingSurfaces(entries: RausgegangenListingEntry[]): RausgegangenListingEntry[] {
  const merged = new Map<string, RausgegangenListingEntry>();

  for (const entry of entries) {
    const existing = merged.get(entry.eventUrl);
    if (!existing) {
      merged.set(entry.eventUrl, { ...entry, listingSurface: entry.listingSurface });
      continue;
    }
    const surfaces = new Set(existing.listingSurface.split('|').filter(Boolean));
    surfaces.add(entry.listingSurface);
    merged.set(entry.eventUrl, {
      ...existing,
      listingSurface: [...surfaces].join('|'),
      listingTitleHint: existing.listingTitleHint ?? entry.listingTitleHint,
    });
  }

  return [...merged.values()];
}
