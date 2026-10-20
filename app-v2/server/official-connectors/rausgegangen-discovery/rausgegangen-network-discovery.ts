import { bundeslandForCity, buildCoverageByState } from '../ticket-evidence/network-discovery/germany-geography';
import {
  buildMatchCatalogFromStaging,
  type StagingCatalogEvent,
} from '../ticket-evidence/network-discovery/match-staging-catalog';
import { DEFAULT_DISCOVERY_BOUNDS, PRIORITY_GERMAN_CITY_SLUGS, RAUSGEGANGEN_BASE_URL } from './constants';
import {
  buildRegionInventoryFromSlugs,
  discoverRegionSlugsFromHomepageHtml,
  displayNameForRegionSlug,
} from './discover-regions';
import {
  applyDetailToCandidate,
  enrichedFromRausgegangenCandidate,
  listingEntryToCandidate,
} from './rausgegangen-enrichment';
import { fetchRausgegangenHtml, type FetchResult } from './rausgegangen-fetch';
import { parseRausgegangenEventDetail } from './parse-rausgegangen-detail';
import { normalizeRausgegangenEventUrl, extractEventSlugFromUrl } from './rausgegangen-url';
import {
  mergeListingSurfaces,
  parseRausgegangenCityListing,
} from './parse-rausgegangen-listing';
import type {
  DiscoveryMode,
  RausgegangenDiscoveryCandidate,
  RausgegangenDiscoverySummary,
  RausgegangenListingEntry,
  RausgegangenRegion,
} from './types';
import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';

export interface RausgegangenNetworkDiscoveryOptions {
  referenceInstant?: Date;
  stagingCatalog?: StagingCatalogEvent[];
  cacheDir?: string;
  maxRegions?: number;
  maxDetailCandidates?: number;
  listingConcurrency?: number;
  detailConcurrency?: number;
  regionSlugs?: string[];
  /** Exact existing public DB sources to refresh ahead of new discoveries. */
  preferredEventUrls?: string[];
  requestDelayMs?: number;
  onVerifiedDetail?: (input: {
    candidate: RausgegangenDiscoveryCandidate;
    enriched: EnrichedTicketIoEvent;
    fetchResult: FetchResult;
  }) => Promise<void>;
}

export interface RausgegangenNetworkDiscoveryResult {
  regions: RausgegangenRegion[];
  listingEntries: RausgegangenListingEntry[];
  candidates: RausgegangenDiscoveryCandidate[];
  enrichedEvents: EnrichedTicketIoEvent[];
  summary: RausgegangenDiscoverySummary;
  coverageByState: Record<string, { shops: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }>;
  coverageByCity: Record<string, { rawEvents: number; upcoming: number; relevant: number; netNew: number; qualityReady: number }>;
  accessReliability: {
    listingFetchSuccess: number;
    listingFetchFailed: number;
    detailFetchSuccess: number;
    detailFetchFailed: number;
    blockedRequests: number;
    timeouts: number;
    parseFailures: number;
  };
  discoveryMode: DiscoveryMode;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]!, current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function isRelevant(candidate: RausgegangenDiscoveryCandidate): boolean {
  return candidate.relevance === 'HIGH_RELEVANCE' || candidate.relevance === 'LIKELY_RELEVANT';
}

export async function runRausgegangenNetworkDiscovery(
  options: RausgegangenNetworkDiscoveryOptions = {},
): Promise<RausgegangenNetworkDiscoveryResult> {
  const referenceInstant = options.referenceInstant ?? new Date();
  const bounds = {
    maxRegions: options.maxRegions ?? DEFAULT_DISCOVERY_BOUNDS.maxRegions,
    maxDetailCandidates: options.maxDetailCandidates ?? DEFAULT_DISCOVERY_BOUNDS.maxDetailCandidates,
    listingConcurrency: options.listingConcurrency ?? DEFAULT_DISCOVERY_BOUNDS.listingConcurrency,
    detailConcurrency: options.detailConcurrency ?? DEFAULT_DISCOVERY_BOUNDS.detailConcurrency,
  };
  const cacheDir = options.cacheDir;
  const accessReliability = {
    listingFetchSuccess: 0,
    listingFetchFailed: 0,
    detailFetchSuccess: 0,
    detailFetchFailed: 0,
    blockedRequests: 0,
    timeouts: 0,
    parseFailures: 0,
  };

  const fetchOptions = { cacheDir, requestDelayMs: options.requestDelayMs };
  const homepage = await fetchRausgegangenHtml(`${RAUSGEGANGEN_BASE_URL}/`, fetchOptions);
  const discoveredSlugs = options.regionSlugs ?? discoverRegionSlugsFromHomepageHtml(homepage.html);
  // An explicitly bounded schedule/smoke set must not expand into a
  // Germany-wide crawl. Default exploration still discovers broad regions.
  const regionSlugs = [...new Set(
    options.regionSlugs ?? [...PRIORITY_GERMAN_CITY_SLUGS, ...discoveredSlugs],
  )].slice(0, bounds.maxRegions);

  const listingCounts = new Map<string, number>();
  const reachable = new Map<string, boolean>();
  const allListingEntries: RausgegangenListingEntry[] = [];

  await mapWithConcurrency(regionSlugs, bounds.listingConcurrency, async (slug) => {
    const listingSurface = `${RAUSGEGANGEN_BASE_URL}/${slug}/`;
    const response = await fetchRausgegangenHtml(listingSurface, fetchOptions);
    if (!response.ok) {
      accessReliability.listingFetchFailed += 1;
      if (response.status === 403) {
        accessReliability.blockedRequests += 1;
      }
      if (response.error?.includes('timeout')) {
        accessReliability.timeouts += 1;
      }
      reachable.set(slug, false);
      listingCounts.set(slug, 0);
      return;
    }
    accessReliability.listingFetchSuccess += 1;
    reachable.set(slug, true);
    const entries = parseRausgegangenCityListing(response.html, slug, listingSurface);
    listingCounts.set(slug, entries.length);
    allListingEntries.push(...entries);
  });

  const preferredEntries: RausgegangenListingEntry[] = [];
  for (const rawUrl of options.preferredEventUrls ?? []) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' ||
          !['rausgegangen.de', 'www.rausgegangen.de'].includes(parsed.hostname)) continue;
      const canonical = normalizeRausgegangenEventUrl(rawUrl);
      const eventSlug = extractEventSlugFromUrl(rawUrl);
      if (!canonical || !eventSlug) continue;
      preferredEntries.push({
        eventUrl: canonical, eventSlug, regionSlug: 'germany',
        listingSurface: RAUSGEGANGEN_BASE_URL,
      });
    } catch {
      // Malformed saved URL cannot trigger a network request.
    }
  }
  // Saved public source URLs are verified first; nationwide listings still
  // contribute candidates for review after those bounded refresh slots.
  const preferredSlugs = new Set(preferredEntries.map(entry => entry.eventSlug));
  const mergedListings = mergeListingSurfaces([...preferredEntries, ...allListingEntries]);
  const regions = buildRegionInventoryFromSlugs(regionSlugs, listingCounts, reachable);
  const discoveryMode: DiscoveryMode =
    regions.filter((region) => region.reachable && PRIORITY_GERMAN_CITY_SLUGS.includes(region.slug)).length >=
    Math.min(PRIORITY_GERMAN_CITY_SLUGS.length, bounds.maxRegions) - 2
      ? 'FULL_ENUMERATION'
      : 'STRATIFIED_SAMPLE';

  const catalog = options.stagingCatalog
    ? buildMatchCatalogFromStaging(options.stagingCatalog)
    : [];

  let candidates = mergedListings.map((entry) => listingEntryToCandidate(entry, referenceInstant));

  const detailTargets = candidates
    .slice()
    .sort((left, right) => {
      const leftScore =
        (preferredSlugs.has(left.eventSlug) ? 100 : 0) +
        (left.relevance === 'HIGH_RELEVANCE' ? 4 : left.relevance === 'LIKELY_RELEVANT' ? 3 : left.relevance === 'AMBIGUOUS' ? 2 : 1) +
        (PRIORITY_GERMAN_CITY_SLUGS.includes(left.regionSlug) ? 2 : 0);
      const rightScore =
        (preferredSlugs.has(right.eventSlug) ? 100 : 0) +
        (right.relevance === 'HIGH_RELEVANCE' ? 4 : right.relevance === 'LIKELY_RELEVANT' ? 3 : right.relevance === 'AMBIGUOUS' ? 2 : 1) +
        (PRIORITY_GERMAN_CITY_SLUGS.includes(right.regionSlug) ? 2 : 0);
      return rightScore - leftScore;
    })
    .slice(0, bounds.maxDetailCandidates);

  const detailBySlug = new Map<string, RausgegangenDiscoveryCandidate>();
  const detailFetchBySlug = new Map<string, FetchResult>();

  await mapWithConcurrency(detailTargets, bounds.detailConcurrency, async (candidate, index) => {
    if (index % 50 === 0) {
      console.error(`[m9.4a] detail ${index + 1}/${detailTargets.length}: ${candidate.title}`);
    }
    const response = await fetchRausgegangenHtml(candidate.canonicalUrl, fetchOptions);
    detailFetchBySlug.set(candidate.eventSlug, response);
    if (!response.ok) {
      accessReliability.detailFetchFailed += 1;
      detailBySlug.set(candidate.eventSlug, {
        ...candidate,
        detailFetched: true,
        detailAccess: response.status === 403 ? 'BLOCKED' : 'DETAIL_NOT_FOUND',
      });
      return;
    }
    accessReliability.detailFetchSuccess += 1;
    try {
      const detail = parseRausgegangenEventDetail(response.html, candidate.canonicalUrl);
      if (!detail.jsonLdPresent) {
        accessReliability.parseFailures += 1;
      }
      detailBySlug.set(candidate.eventSlug, applyDetailToCandidate(candidate, detail, referenceInstant));
    } catch {
      accessReliability.parseFailures += 1;
      detailBySlug.set(candidate.eventSlug, {
        ...candidate,
        detailFetched: true,
        detailAccess: 'PARTIAL_DETAIL',
      });
    }
  });

  candidates = candidates.map((candidate) => detailBySlug.get(candidate.eventSlug) ?? candidate);
  const enrichedEvents = candidates.map((candidate) =>
    enrichedFromRausgegangenCandidate(candidate, catalog, referenceInstant),
  );

  if (options.onVerifiedDetail) {
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      const enriched = enrichedEvents[index]!;
      const fetchResult = detailFetchBySlug.get(candidate.eventSlug);
      if (!fetchResult?.ok) {
        continue;
      }
      await options.onVerifiedDetail({ candidate, enriched, fetchResult });
    }
  }

  const duplicateListingEntries = allListingEntries.length - mergedListings.length;
  const lifecycle = { upcoming: 0, ongoing: 0, ended: 0, unknown: 0 };
  const relevance = { high: 0, likely: 0, ambiguous: 0, irrelevant: 0 };
  const identity = {
    existingExact: 0,
    existingStrong: 0,
    possibleMatch: 0,
    netNew: 0,
    reviewRequired: 0,
  };

  for (const candidate of candidates) {
    if (candidate.lifecycle === 'UPCOMING') lifecycle.upcoming += 1;
    else if (candidate.lifecycle === 'ONGOING') lifecycle.ongoing += 1;
    else if (candidate.lifecycle === 'ENDED') lifecycle.ended += 1;
    else lifecycle.unknown += 1;

    if (candidate.relevance === 'HIGH_RELEVANCE') relevance.high += 1;
    else if (candidate.relevance === 'LIKELY_RELEVANT') relevance.likely += 1;
    else if (candidate.relevance === 'AMBIGUOUS') relevance.ambiguous += 1;
    else relevance.irrelevant += 1;

    if (candidate.matchClassification === 'EXISTING_EXACT') identity.existingExact += 1;
    else if (candidate.matchClassification === 'EXISTING_STRONG_MATCH') identity.existingStrong += 1;
    else if (candidate.matchClassification === 'POSSIBLE_MATCH') identity.possibleMatch += 1;
    else if (candidate.matchClassification === 'NET_NEW') identity.netNew += 1;
    else identity.reviewRequired += 1;
  }

  const coverageByState = buildCoverageByState(
    regions
      .filter((region) => region.reachable)
      .map((region) => {
        const regionCandidates = candidates.filter((candidate) => candidate.regionSlug === region.slug);
        const upcoming = regionCandidates.filter((candidate) => candidate.lifecycle !== 'ENDED');
        const relevant = upcoming.filter(isRelevant);
        const netNew = relevant.filter((candidate) => candidate.matchClassification === 'NET_NEW');
        return {
          bundesland: region.bundesland ?? 'Unknown',
          shopCount: 1,
          upcomingEvents: upcoming.length,
          electronicCandidates: relevant.length,
          netNewCandidates: netNew.length,
        };
      }),
  );

  const coverageByCity: Record<string, { rawEvents: number; upcoming: number; relevant: number; netNew: number; qualityReady: number }> = {};
  for (const region of regions) {
    const regionCandidates = candidates.filter((candidate) => candidate.regionSlug === region.slug);
    const upcoming = regionCandidates.filter((candidate) => candidate.lifecycle !== 'ENDED');
    const relevant = upcoming.filter(isRelevant);
    const netNew = relevant.filter((candidate) => candidate.matchClassification === 'NET_NEW');
    const qualityReady = enrichedEvents.filter(
      (event) =>
        event.shopSlug === region.slug &&
        event.qualification === 'IMPORT_CANDIDATE' &&
        event.lifecycle !== 'ENDED' &&
        (event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT'),
    ).length;

    coverageByCity[region.displayName] = {
      rawEvents: regionCandidates.length,
      upcoming: upcoming.length,
      relevant: relevant.length,
      netNew: netNew.length,
      qualityReady,
    };
  }

  const summary: RausgegangenDiscoverySummary = {
    generatedAt: new Date().toISOString(),
    referenceInstant: referenceInstant.toISOString(),
    discoveryMode,
    regionsDiscovered: regions.length,
    regionsReachable: regions.filter((region) => region.reachable).length,
    rawListingEntries: allListingEntries.length,
    uniqueEventUrls: mergedListings.length,
    duplicateListingEntries,
    regionsCovered: regions.filter((region) => region.listingEventCount > 0).length,
    detailFetched: detailBySlug.size,
    lifecycle,
    relevance,
    identity,
  };

  return {
    regions,
    listingEntries: mergedListings,
    candidates,
    enrichedEvents,
    summary,
    coverageByState,
    coverageByCity,
    accessReliability,
    discoveryMode,
  };
}
