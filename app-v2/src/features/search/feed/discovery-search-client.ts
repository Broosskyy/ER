import { buildDiscoveryCacheKey } from '@/features/discovery/api/cache/discovery-cache-key';
import { DEFAULT_DISCOVERY_API_VERSION } from '@/features/discovery/api/domain/discovery-api-version';
import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';
import type { DiscoveryCursor } from '@/features/discovery/domain/discovery-pagination-types';
import { DEFAULT_DISCOVERY_PAGE_SIZE } from '@/features/discovery/domain/discovery-pagination-types';
import { mapEventFiltersToDiscoveryQuery } from '@/features/discovery/utils/map-event-filters-to-discovery-query';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  getActiveCityOptions,
  getActiveGenreOptions,
} from '@/features/search/config/filter-config';
import type { EventFilters } from '@/features/search/constants';

import type {
  DiscoverySearchLoadOptions,
  DiscoverySearchLoadResult,
  DiscoverySearchLocationContext,
  DiscoverySearchSuggestion,
} from './search-feed-types';
import { trackSearchTelemetry } from './search-telemetry';

const inflightRequests = new Map<string, Promise<DiscoverySearchLoadResult>>();

function mapResponseItems(items: Array<{ event: EventDisplayModel }>): EventDisplayModel[] {
  return items.map((item) => item.event);
}

function buildRequestKey(filters: EventFilters, location: DiscoverySearchLocationContext, cursor?: DiscoveryCursor): string {
  return buildDiscoveryCacheKey({
    version: DEFAULT_DISCOVERY_API_VERSION,
    route: 'search.events',
    params: {
      ...filters,
      latitude: location.latitude,
      longitude: location.longitude,
      cursor: cursor?.encoded,
    },
  });
}

async function executeDiscoverySearch(
  filters: EventFilters,
  options: DiscoverySearchLoadOptions,
): Promise<DiscoverySearchLoadResult> {
  const startedAt = Date.now();
  const platform = getDiscoveryQueryPlatform();
  const location = options.location ?? {};
  const limit = options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE;
  const query = mapEventFiltersToDiscoveryQuery(filters, {
    surface: 'search_events',
    limit,
    cursor: options.cursor,
    latitude: location.latitude,
    longitude: location.longitude,
  });

  const response = await platform.filterEvents(query);

  if (!response.ok) {
    const message =
      'error' in response && response.error && typeof response.error === 'object' && 'message' in response.error
        ? String(response.error.message)
        : 'Discovery search failed.';
    throw new Error(message);
  }

  const events = mapResponseItems(response.data.items);

  return {
    events,
    hasMore: response.pagination?.hasMore ?? false,
    cursor: response.pagination?.nextCursor,
    totalMatched: response.pagination?.totalMatched ?? events.length,
    durationMs: response.meta.performance.durationMs ?? Date.now() - startedAt,
  };
}

export async function loadDiscoverySearchResults(
  filters: EventFilters,
  options: DiscoverySearchLoadOptions = {},
): Promise<DiscoverySearchLoadResult> {
  const location = options.location ?? {};
  const requestKey = buildRequestKey(filters, location, options.cursor);

  if (!options.bypassCache && inflightRequests.has(requestKey)) {
    return inflightRequests.get(requestKey)!;
  }

  trackSearchTelemetry('search_start', {
    query: filters.query.trim() || undefined,
    filterCount: countAppliedFilters(filters),
  });

  const request = executeDiscoverySearch(filters, options)
    .then((result) => {
      trackSearchTelemetry('search_complete', {
        query: filters.query.trim() || undefined,
        durationMs: result.durationMs,
        resultCount: result.events.length,
        filterCount: countAppliedFilters(filters),
      });
      return result;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Search failed.';
      trackSearchTelemetry('search_error', {
        query: filters.query.trim() || undefined,
        error: message,
        filterCount: countAppliedFilters(filters),
      });
      throw error;
    })
    .finally(() => {
      inflightRequests.delete(requestKey);
    });

  inflightRequests.set(requestKey, request);
  return request;
}

export async function loadMoreDiscoverySearchResults(
  filters: EventFilters,
  cursor: DiscoveryCursor,
  options: DiscoverySearchLoadOptions = {},
): Promise<DiscoverySearchLoadResult> {
  trackSearchTelemetry('search_pagination', { query: filters.query.trim() || undefined });
  return loadDiscoverySearchResults(filters, {
    ...options,
    cursor,
    bypassCache: true,
  });
}

export async function loadDiscoverySearchSuggestions(
  query: string,
  location: DiscoverySearchLocationContext = {},
): Promise<DiscoverySearchSuggestion[]> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return [];
  }

  trackSearchTelemetry('search_suggestions', { query: normalized });

  const suggestions: DiscoverySearchSuggestion[] = [];
  const lower = normalized.toLowerCase();

  for (const genre of getActiveGenreOptions()) {
    if (genre.label.toLowerCase().includes(lower)) {
      suggestions.push({
        id: `genre-${genre.id}`,
        kind: 'genre',
        title: genre.label,
        subtitle: 'Genre',
        query: genre.label,
      });
    }
  }

  for (const city of getActiveCityOptions()) {
    if (city.label.toLowerCase().includes(lower)) {
      suggestions.push({
        id: `city-${city.id}`,
        kind: 'city',
        title: city.label,
        subtitle: 'Stadt',
        query: city.label,
      });
    }
  }

  try {
    const platform = getDiscoveryQueryPlatform();
    const response = await platform.searchEvents({
      text: normalized,
      limit: 5,
      locale: 'de',
      city: location.city,
    });

    if (response.ok) {
      for (const item of response.data.items) {
        suggestions.push({
          id: `event-${item.event.id}`,
          kind: 'event',
          title: item.event.title,
          subtitle: item.event.city,
          query: item.event.title,
        });
      }
    }
  } catch {
    // Suggestions are best-effort.
  }

  return suggestions.slice(0, 8);
}

export function clearDiscoverySearchRequestCache(): void {
  inflightRequests.clear();
}

function countAppliedFilters(filters: EventFilters): number {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.dateRange !== 'all-dates') count += 1;
  if (filters.genres.length > 0) count += 1;
  if (filters.distance !== 'any') count += 1;
  if (filters.price !== 'any') count += 1;
  if (filters.venueEnvironment !== 'any') count += 1;
  if (filters.venueId) count += 1;
  if (filters.organizerId) count += 1;
  if (filters.festivalId) count += 1;
  if (filters.dateStartAt || filters.dateEndAt) count += 1;
  return count;
}
