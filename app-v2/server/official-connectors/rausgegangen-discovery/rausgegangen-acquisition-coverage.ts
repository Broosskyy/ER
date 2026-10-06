import { randomUUID } from 'node:crypto';

import type { EventMatchCatalogEntry } from '../../ingestion/identity/event-match-types';
import {
  buildMatchCatalogFromStaging,
  type StagingCatalogEvent,
} from '../ticket-evidence/network-discovery/match-staging-catalog';
import { PRIORITY_GERMAN_CITY_SLUGS, RAUSGEGANGEN_BASE_URL } from './constants';
import {
  DEFAULT_ACQUISITION_COVERAGE_BOUNDS,
  type AcquisitionCoverageBounds,
  type RausgegangenDiscoverySurface,
  type UnionDiscoveredEvent,
} from './discovery-surfaces';
import { discoverRegionSlugsFromHomepageHtml } from './discover-regions';
import {
  applyDetailToCandidate,
  enrichedFromRausgegangenCandidate,
  listingEntryToCandidate,
} from './rausgegangen-enrichment';
import { fetchRausgegangenHtml, type FetchResult } from './rausgegangen-fetch';
import { parseRausgegangenEventDetail } from './parse-rausgegangen-detail';
import {
  mergeListingSurfaces,
  parseRausgegangenCityListing,
} from './parse-rausgegangen-listing';
import type { RausgegangenDiscoveryCandidate, RausgegangenListingEntry } from './types';
import {
  extractLocationLinksFromHtml,
  extractLocationSlugsFromEventSlug,
  extractLocationSlugFromUrl,
  inferLocationUrlFromVenueName,
  normalizeLocationUrl,
} from './location-url';
import { classifyElectronicRelevance } from '../ticket-evidence/network-discovery/relevance-classifier';
import {
  qualifyLocationSurfaceCandidates,
  selectLocationSurfacesToCrawl,
  type LocationCandidateSeed,
} from './location-surface-qualification';
import { compareRollingWindows, classifyEventWindow } from './rolling-window';
import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import { loadAcquisitionCheckpoint, saveAcquisitionCheckpoint } from './acquisition-checkpoint';

export interface SourceLoadMetrics {
  httpRequests: number;
  cacheHits: number;
  cacheMisses: number;
  failedRequests: number;
  retries: number;
  totalRuntimeMs: number;
  peakConcurrency: number;
}

export interface AcquisitionCoverageOptions {
  referenceInstant?: Date;
  stagingCatalog?: StagingCatalogEvent[];
  cacheDir?: string;
  checkpointPath?: string;
  bounds?: Partial<AcquisitionCoverageBounds>;
  runId?: string;
  onProgress?: (message: string) => void;
}

export interface AcquisitionCoverageResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  bounds: AcquisitionCoverageBounds;
  citySurfaces: RausgegangenDiscoverySurface[];
  locationCandidates: ReturnType<typeof qualifyLocationSurfaceCandidates>;
  locationSurfacesCrawled: RausgegangenDiscoverySurface[];
  unionEvents: UnionDiscoveredEvent[];
  cityDiscoveredCount: number;
  locationDiscoveredCount: number;
  cityOnlyCount: number;
  locationOnlyCount: number;
  cityAndLocationCount: number;
  candidates: RausgegangenDiscoveryCandidate[];
  enrichedEvents: EnrichedTicketIoEvent[];
  rollingWindowComparison: ReturnType<typeof compareRollingWindows>;
  activeWindowDays: number;
  activeWindowDiscovered: number;
  activeWindowDetailEnriched: number;
  activeWindowInaccessible: number;
  activeWindowDetailCoverageRate: number;
  sourceLoadMetrics: SourceLoadMetrics;
  inaccessibleDetails: Array<{ eventUrl: string; reason: string }>;
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

function mergeUnionEvent(
  map: Map<string, UnionDiscoveredEvent>,
  entry: RausgegangenListingEntry,
  provenance: UnionDiscoveredEvent['discoveredBy'][number],
): void {
  const existing = map.get(entry.eventUrl);
  if (!existing) {
    map.set(entry.eventUrl, {
      eventUrl: entry.eventUrl,
      eventSlug: entry.eventSlug,
      listingTitleHint: entry.listingTitleHint,
      regionSlug: entry.regionSlug,
      discoveredBy: [provenance],
    });
    return;
  }
  if (!existing.discoveredBy.some((item) => item.surfaceUrl === provenance.surfaceUrl)) {
    existing.discoveredBy.push(provenance);
  }
}

export async function runRausgegangenAcquisitionCoverage(
  options: AcquisitionCoverageOptions = {},
): Promise<AcquisitionCoverageResult> {
  const startedAt = new Date();
  const referenceInstant = options.referenceInstant ?? new Date();
  const bounds: AcquisitionCoverageBounds = { ...DEFAULT_ACQUISITION_COVERAGE_BOUNDS, ...options.bounds };
  const runId = options.runId ?? randomUUID();
  const cacheDir = options.cacheDir;
  const checkpoint = options.checkpointPath ? loadAcquisitionCheckpoint(options.checkpointPath) : undefined;
  const progress = options.onProgress ?? (() => undefined);

  const metrics: SourceLoadMetrics = {
    httpRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failedRequests: 0,
    retries: 0,
    totalRuntimeMs: 0,
    peakConcurrency: Math.max(bounds.listingConcurrency, bounds.detailConcurrency),
  };

  const trackedFetch = async (
    url: string,
    fetchOptions: { skipCache?: boolean } = {},
  ): Promise<FetchResult> => {
    if (metrics.httpRequests >= bounds.maxGraphRequests) {
      return { ok: false, status: 0, html: '', finalUrl: url, fromCache: false, error: 'request_budget_exhausted' };
    }
    metrics.httpRequests += 1;
    const result = await fetchRausgegangenHtml(url, {
      cacheDir,
      skipCache: fetchOptions.skipCache,
      requestDelayMs: bounds.requestDelayMs,
      timeoutMs: bounds.fetchTimeoutMs,
      maxRetries: bounds.maxRetries,
    });
    if (result.fromCache) {
      metrics.cacheHits += 1;
    } else {
      metrics.cacheMisses += 1;
    }
    if (!result.ok) {
      metrics.failedRequests += 1;
    }
    return result;
  };

  const discoveredAt = referenceInstant.toISOString();
  const citySurfaces: RausgegangenDiscoverySurface[] = [];
  const locationSurfacesCrawled: RausgegangenDiscoverySurface[] = [];
  const unionMap = new Map<string, UnionDiscoveredEvent>();
  const locationSeeds: LocationCandidateSeed[] = [];

  const homepage = await trackedFetch(`${RAUSGEGANGEN_BASE_URL}/`);
  const discoveredSlugs = discoverRegionSlugsFromHomepageHtml(homepage.html);
  const regionSlugs = [...new Set([...PRIORITY_GERMAN_CITY_SLUGS, ...discoveredSlugs])].slice(0, bounds.maxRegions);

  const allCityEntries: RausgegangenListingEntry[] = [];
  await mapWithConcurrency(regionSlugs, bounds.listingConcurrency, async (slug) => {
    const surfaceUrl = `${RAUSGEGANGEN_BASE_URL}/${slug}/`;
    const response = await trackedFetch(surfaceUrl, { skipCache: true });
    citySurfaces.push({
      surfaceType: 'CITY',
      surfaceUrl,
      surfaceId: slug,
      discoveredAt,
      discoveryRunId: runId,
    });
    if (!response.ok) {
      return;
    }
    const entries = parseRausgegangenCityListing(response.html, slug, surfaceUrl);
    allCityEntries.push(...entries);
    for (const entry of entries) {
      mergeUnionEvent(unionMap, entry, {
        surfaceType: 'CITY',
        surfaceId: slug,
        surfaceUrl,
        discoveredAt,
      });
    }
    for (const locationUrl of extractLocationLinksFromHtml(response.html)) {
      locationSeeds.push({
        locationUrl,
        evidenceSources: ['city_listing_link'],
        observedTitles: [],
        observedGenreHints: [],
      });
    }
  });

  for (const entry of allCityEntries) {
    for (const venueSlug of extractLocationSlugsFromEventSlug(entry.eventSlug)) {
      const locationUrl = normalizeLocationUrl(venueSlug);
      if (!locationUrl) {
        continue;
      }
      locationSeeds.push({
        locationUrl,
        evidenceSources: ['event_slug_venue_hint'],
        observedTitles: [entry.listingTitleHint ?? entry.eventSlug],
        observedGenreHints: [],
      });
    }
  }

  for (const row of options.stagingCatalog ?? []) {
    const official = row.officialUrl ?? '';
    const normalized = normalizeLocationUrl(official);
    if (normalized) {
      locationSeeds.push({
        locationUrl: normalized,
        evidenceSources: ['staging_venue'],
        observedTitles: [row.title],
        observedGenreHints: [],
      });
    }
  }

  const seedSample = mergeListingSurfaces(allCityEntries)
    .slice()
    .sort((left, right) => {
      const leftScore =
        (classifyElectronicRelevance({ title: left.listingTitleHint ?? left.eventSlug }).relevance === 'HIGH_RELEVANCE'
          ? 4
          : classifyElectronicRelevance({ title: left.listingTitleHint ?? left.eventSlug }).relevance ===
              'LIKELY_RELEVANT'
            ? 3
            : 1) + (PRIORITY_GERMAN_CITY_SLUGS.includes(left.regionSlug) ? 2 : 0);
      const rightScore =
        (classifyElectronicRelevance({ title: right.listingTitleHint ?? right.eventSlug }).relevance === 'HIGH_RELEVANCE'
          ? 4
          : classifyElectronicRelevance({ title: right.listingTitleHint ?? right.eventSlug }).relevance ===
              'LIKELY_RELEVANT'
            ? 3
            : 1) + (PRIORITY_GERMAN_CITY_SLUGS.includes(right.regionSlug) ? 2 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 500);
  await mapWithConcurrency(seedSample, bounds.detailConcurrency, async (entry, index) => {
    if (index % 25 === 0) {
      progress(`[m9.4c] location seed detail ${index + 1}/${seedSample.length}`);
    }
    const response = await trackedFetch(entry.eventUrl);
    if (!response.ok) {
      return;
    }
    for (const locationUrl of extractLocationLinksFromHtml(response.html)) {
      locationSeeds.push({
        locationUrl,
        evidenceSources: ['detail_venue_link'],
        observedTitles: [entry.listingTitleHint ?? entry.eventSlug],
        observedGenreHints: [],
      });
    }
    const detail = parseRausgegangenEventDetail(response.html, entry.eventUrl);
    const inferred = inferLocationUrlFromVenueName(detail.venueName);
    if (inferred) {
      locationSeeds.push({
        locationUrl: inferred,
        evidenceSources: ['detail_venue_name'],
        observedTitles: [entry.listingTitleHint ?? detail.title ?? entry.eventSlug],
        observedGenreHints: detail.genreHints,
      });
    }
  });

  const visitedLocations = new Set<string>();
  const deferredLocationUrls = new Set<string>();
  let locationCandidates = qualifyLocationSurfaceCandidates(locationSeeds);
  const crawlQueue = selectLocationSurfacesToCrawl(locationCandidates, bounds.maxLocationSurfaces);

  function queueDeferredLocation(locationUrl: string): void {
    const slug = extractLocationSlugFromUrl(locationUrl);
    if (!slug || visitedLocations.has(slug)) {
      return;
    }
    deferredLocationUrls.add(locationUrl);
  }

  for (let depth = 0; depth < bounds.maxExpansionDepth; depth += 1) {
    const batch = crawlQueue.filter((candidate) => !visitedLocations.has(candidate.locationSlug));
    if (batch.length === 0) {
      break;
    }
    await mapWithConcurrency(batch, bounds.listingConcurrency, async (candidate) => {
      if (visitedLocations.has(candidate.locationSlug)) {
        return;
      }
      visitedLocations.add(candidate.locationSlug);
      const response = await trackedFetch(candidate.locationUrl, { skipCache: true });
      locationSurfacesCrawled.push({
        surfaceType: 'LOCATION',
        surfaceUrl: candidate.locationUrl,
        surfaceId: candidate.locationSlug,
        discoveredAt,
        discoveryRunId: runId,
        sourceEvidence: candidate.evidenceSources.join('|'),
      });
      if (!response.ok) {
        return;
      }
      const entries = parseRausgegangenCityListing(response.html, 'location', candidate.locationUrl);
      for (const entry of entries) {
        mergeUnionEvent(unionMap, entry, {
          surfaceType: 'LOCATION',
          surfaceId: candidate.locationSlug,
          surfaceUrl: candidate.locationUrl,
          discoveredAt,
        });
      }
      for (const locationUrl of extractLocationLinksFromHtml(response.html)) {
        const slug = extractLocationSlugFromUrl(locationUrl);
        if (!slug || visitedLocations.has(slug)) {
          continue;
        }
        locationSeeds.push({
          locationUrl,
          evidenceSources: ['recursive_expansion'],
          observedTitles: entries.map((entry) => entry.listingTitleHint ?? entry.eventSlug),
          observedGenreHints: [],
        });
        const expandedCandidate = qualifyLocationSurfaceCandidates([
          {
            locationUrl,
            evidenceSources: ['recursive_expansion'],
            observedTitles: entries.map((entry) => entry.listingTitleHint ?? entry.eventSlug),
            observedGenreHints: [],
          },
        ])[0];
        if (
          expandedCandidate &&
          !crawlQueue.some((entry) => entry.locationSlug === expandedCandidate.locationSlug)
        ) {
          crawlQueue.push(expandedCandidate);
        }
      }
    });

    if (depth + 1 >= bounds.maxExpansionDepth) {
      break;
    }
    locationCandidates = qualifyLocationSurfaceCandidates(locationSeeds);
    const nextCandidates = selectLocationSurfacesToCrawl(locationCandidates, bounds.maxLocationSurfaces);
    for (const candidate of nextCandidates) {
      if (!crawlQueue.some((entry) => entry.locationSlug === candidate.locationSlug)) {
        crawlQueue.push(candidate);
      }
    }
  }

  const unionEvents = [...unionMap.values()];
  const cityOnlyCount = unionEvents.filter((event) =>
    event.discoveredBy.every((item) => item.surfaceType === 'CITY'),
  ).length;
  const locationOnlyCount = unionEvents.filter((event) =>
    event.discoveredBy.every((item) => item.surfaceType === 'LOCATION'),
  ).length;
  const cityAndLocationCount = unionEvents.filter(
    (event) =>
      event.discoveredBy.some((item) => item.surfaceType === 'CITY') &&
      event.discoveredBy.some((item) => item.surfaceType === 'LOCATION'),
  ).length;

  const catalog: EventMatchCatalogEntry[] = options.stagingCatalog
    ? buildMatchCatalogFromStaging(options.stagingCatalog)
    : [];

  let candidates = unionEvents.map((event) => {
    const listingEntry: RausgegangenListingEntry = {
      eventUrl: event.eventUrl,
      eventSlug: event.eventSlug,
      regionSlug: event.regionSlug ?? event.discoveredBy[0]?.surfaceId ?? 'unknown',
      listingSurface: event.discoveredBy.map((item) => item.surfaceUrl).join('|'),
      listingTitleHint: event.listingTitleHint,
    };
    return listingEntryToCandidate(listingEntry, referenceInstant);
  });

  const inaccessibleDetails: Array<{ eventUrl: string; reason: string }> = [];
  const detailBySlug = new Map<string, RausgegangenDiscoveryCandidate>();
  const completedSlugs = new Set(checkpoint?.completedDetailSlugs ?? []);

  const locationOnlySlugSet = new Set(
    unionEvents
      .filter((event) => event.discoveredBy.every((item) => item.surfaceType === 'LOCATION'))
      .map((event) => event.eventSlug),
  );

  function detailPriority(candidate: RausgegangenDiscoveryCandidate): number {
    let score = 0;
    if (locationOnlySlugSet.has(candidate.eventSlug)) {
      score += 100;
    }
    if (PRIORITY_GERMAN_CITY_SLUGS.includes(candidate.regionSlug)) {
      score += 20;
    }
    if (candidate.relevance === 'HIGH_RELEVANCE') {
      score += 10;
    } else if (candidate.relevance === 'LIKELY_RELEVANT') {
      score += 7;
    } else if (candidate.relevance === 'AMBIGUOUS') {
      score += 3;
    }
    return score;
  }

  async function enrichCandidate(candidate: RausgegangenDiscoveryCandidate, index: number, total: number): Promise<void> {
    if (detailBySlug.has(candidate.eventSlug)) {
      return;
    }
    if (index % 100 === 0) {
      progress(`[m9.4c] detail ${index + 1}/${total}: ${candidate.title}`);
    }
    const response = await trackedFetch(candidate.canonicalUrl);
    if (!response.ok) {
      inaccessibleDetails.push({ eventUrl: candidate.canonicalUrl, reason: response.error ?? `http_${response.status}` });
      detailBySlug.set(candidate.eventSlug, {
        ...candidate,
        detailFetched: true,
        detailAccess: response.status === 403 ? 'BLOCKED' : 'DETAIL_NOT_FOUND',
      });
      return;
    }
    try {
      const detail = parseRausgegangenEventDetail(response.html, candidate.canonicalUrl);
      const inferredLocation = inferLocationUrlFromVenueName(detail.venueName);
      if (inferredLocation) {
        queueDeferredLocation(inferredLocation);
      }
      detailBySlug.set(candidate.eventSlug, applyDetailToCandidate(candidate, detail, referenceInstant));
      completedSlugs.add(candidate.eventSlug);
      if (options.checkpointPath && index % 50 === 0) {
        saveAcquisitionCheckpoint(options.checkpointPath, {
          runId,
          updatedAt: new Date().toISOString(),
          completedDetailSlugs: [...completedSlugs],
          completedLocationSlugs: [...visitedLocations],
          completedCitySlugs: regionSlugs,
        });
      }
    } catch {
      inaccessibleDetails.push({ eventUrl: candidate.canonicalUrl, reason: 'parse_failure' });
      detailBySlug.set(candidate.eventSlug, {
        ...candidate,
        detailFetched: true,
        detailAccess: 'PARTIAL_DETAIL',
      });
    }
  }

  const prioritizedCandidates = candidates
    .slice()
    .sort((left, right) => detailPriority(right) - detailPriority(left));

  const locationOnlyTargets = prioritizedCandidates.filter((candidate) => locationOnlySlugSet.has(candidate.eventSlug));
  await mapWithConcurrency(locationOnlyTargets, bounds.detailConcurrency, async (candidate, index) => {
    await enrichCandidate(candidate, index, locationOnlyTargets.length);
  });

  for (let round = 0; round < 40; round += 1) {
    const merged = candidates.map((candidate) => detailBySlug.get(candidate.eventSlug) ?? candidate);
    const activeWindowGaps = merged.filter((candidate) => {
      if (candidate.detailFetched) {
        return false;
      }
      if (locationOnlySlugSet.has(candidate.eventSlug)) {
        return true;
      }
      if (candidate.lifecycle !== 'UNKNOWN') {
        return (
          classifyEventWindow(candidate.startsAt, candidate.lifecycle, referenceInstant, bounds.activeWindowDays) ===
          'ACTIVE_WINDOW'
        );
      }
      return candidate.relevance !== 'IRRELEVANT';
    });
    if (activeWindowGaps.length === 0 || metrics.httpRequests >= bounds.maxGraphRequests) {
      break;
    }
    const batch = activeWindowGaps
      .slice()
      .sort((left, right) => detailPriority(right) - detailPriority(left))
      .slice(0, 500);
    await mapWithConcurrency(batch, bounds.detailConcurrency, async (candidate, index) => {
      await enrichCandidate(candidate, index, batch.length);
    });
  }

  candidates = candidates.map((candidate) => detailBySlug.get(candidate.eventSlug) ?? candidate);
  const enrichedEvents = candidates.map((candidate) =>
    enrichedFromRausgegangenCandidate(candidate, catalog, referenceInstant),
  );

  const rollingWindowComparison = compareRollingWindows({
    events: candidates,
    referenceInstant,
    windows: [30, 60, 90, 120],
  });

  const activeWindowDays = bounds.activeWindowDays;
  const activeWindowCandidates = candidates.filter(
    (candidate) =>
      classifyEventWindow(candidate.startsAt, candidate.lifecycle, referenceInstant, activeWindowDays) ===
      'ACTIVE_WINDOW',
  );
  const activeWindowAccessible = activeWindowCandidates.filter(
    (candidate) => candidate.detailAccess === 'DETAIL_ACCESSIBLE' || candidate.detailAccess === 'PARTIAL_DETAIL',
  );
  const activeWindowInaccessible = activeWindowCandidates.length - activeWindowAccessible.length;
  const activeWindowDetailCoverageRate =
    activeWindowCandidates.length === 0
      ? 1
      : activeWindowAccessible.length / activeWindowCandidates.length;

  metrics.totalRuntimeMs = Date.now() - startedAt.getTime();

  if (options.checkpointPath) {
    saveAcquisitionCheckpoint(options.checkpointPath, {
      runId,
      updatedAt: new Date().toISOString(),
      completedDetailSlugs: [...completedSlugs],
      completedLocationSlugs: [...visitedLocations],
      completedCitySlugs: regionSlugs,
    });
  }

  return {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    bounds,
    citySurfaces,
    locationCandidates,
    locationSurfacesCrawled,
    unionEvents,
    cityDiscoveredCount: unionEvents.filter((event) => event.discoveredBy.some((item) => item.surfaceType === 'CITY')).length,
    locationDiscoveredCount: unionEvents.filter((event) => event.discoveredBy.some((item) => item.surfaceType === 'LOCATION')).length,
    cityOnlyCount,
    locationOnlyCount,
    cityAndLocationCount,
    candidates,
    enrichedEvents,
    rollingWindowComparison,
    activeWindowDays,
    activeWindowDiscovered: activeWindowCandidates.length,
    activeWindowDetailEnriched: activeWindowAccessible.length,
    activeWindowInaccessible,
    activeWindowDetailCoverageRate,
    sourceLoadMetrics: metrics,
    inaccessibleDetails,
  };
}

export function isEhrenklubRegressionEvent(event: UnionDiscoveredEvent | RausgegangenDiscoveryCandidate): boolean {
  const slug = 'eventSlug' in event ? event.eventSlug : (event as UnionDiscoveredEvent).eventSlug;
  return slug === 'ehrenklub-im-schrotty-14-0';
}

export function ehrenklubDiscoveredViaLocation(event?: UnionDiscoveredEvent): boolean {
  if (!event) {
    return false;
  }
  return event.discoveredBy.some((item) => item.surfaceType === 'LOCATION' && item.surfaceId === 'schrotty');
}
