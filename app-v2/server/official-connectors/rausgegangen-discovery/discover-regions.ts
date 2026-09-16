import { bundeslandForCity, normalizeGermanCity } from '../ticket-evidence/network-discovery/germany-geography';
import {
  NON_CITY_PATHS,
  PRIORITY_GERMAN_CITY_SLUGS,
  RAUSGEGANGEN_BASE_URL,
  SLUG_TO_DISPLAY_NAME,
} from './constants';
import { extractCitySlugsFromHtml } from './parse-rausgegangen-listing';
import type { RegionCoverageClass, RausgegangenRegion } from './types';
import { normalizeRausgegangenRegionUrl } from './rausgegangen-url';

export function displayNameForRegionSlug(slug: string): string {
  if (SLUG_TO_DISPLAY_NAME[slug]) {
    return SLUG_TO_DISPLAY_NAME[slug];
  }
  const fromRegistry = normalizeGermanCity(slug.replace(/-/g, ' '));
  if (fromRegistry) {
    return fromRegistry.canonical;
  }
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function classifyRegionCoverage(listingEventCount: number, reachable: boolean): RegionCoverageClass {
  if (!reachable) {
    return 'NONE';
  }
  if (listingEventCount >= 300) {
    return 'STRONG';
  }
  if (listingEventCount >= 80) {
    return 'MODERATE';
  }
  if (listingEventCount > 0) {
    return 'WEAK';
  }
  return 'UNKNOWN';
}

export function buildRegionInventoryFromSlugs(
  slugs: string[],
  listingCounts: Map<string, number>,
  reachable: Map<string, boolean>,
): RausgegangenRegion[] {
  const unique = [...new Set(slugs.map((slug) => slug.toLowerCase()).filter((slug) => !NON_CITY_PATHS.has(slug)))];

  const sorted = unique.sort((left, right) => {
    const leftPriority = PRIORITY_GERMAN_CITY_SLUGS.indexOf(left);
    const rightPriority = PRIORITY_GERMAN_CITY_SLUGS.indexOf(right);
    const leftScore = leftPriority >= 0 ? leftPriority : 1000;
    const rightScore = rightPriority >= 0 ? rightPriority : 1000;
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return (listingCounts.get(right) ?? 0) - (listingCounts.get(left) ?? 0);
  });

  return sorted.map((slug) => {
    const displayName = displayNameForRegionSlug(slug);
    const geo = bundeslandForCity(displayName);
    const listingEventCount = listingCounts.get(slug) ?? 0;
    const isReachable = reachable.get(slug) ?? false;
    const notes: string[] = [];
    if (!geo.bundesland) {
      notes.push('bundesland_unresolved');
    }
    if (PRIORITY_GERMAN_CITY_SLUGS.includes(slug)) {
      notes.push('priority_metro');
    }

    return {
      slug,
      displayName,
      bundesland: geo.bundesland,
      stateCode: geo.stateCode,
      listingSurface: normalizeRausgegangenRegionUrl(slug),
      reachable: isReachable,
      listingEventCount,
      paginationDepth: 1,
      coverageClass: classifyRegionCoverage(listingEventCount, isReachable),
      notes,
    };
  });
}

export function discoverRegionSlugsFromHomepageHtml(html: string): string[] {
  const fromLinks = extractCitySlugsFromHtml(html);
  const footerNav = [...html.matchAll(/href=["']https:\/\/rausgegangen\.de\/([a-z0-9-]+)\//gi)].map(
    (match) => match[1]?.toLowerCase() ?? '',
  );
  return [...new Set([...fromLinks, ...footerNav, ...PRIORITY_GERMAN_CITY_SLUGS])].filter(
    (slug) => slug && !NON_CITY_PATHS.has(slug),
  );
}

export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1] ?? '');
}

export function regionSlugsFromSitemapCityHome(xml: string): string[] {
  return extractSitemapLocs(xml)
    .map((url) => url.replace(RAUSGEGANGEN_BASE_URL, '').replace(/^\/|\/$/g, '').toLowerCase())
    .filter((slug) => slug && !NON_CITY_PATHS.has(slug));
}
