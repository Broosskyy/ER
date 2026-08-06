import { buildDiscoveryCacheKey } from '@/features/discovery/api/cache/discovery-cache-key';
import { DEFAULT_DISCOVERY_API_VERSION } from '@/features/discovery/api/domain/discovery-api-version';
import {
  buildGenreQuery,
  buildNewlyAddedQuery,
  buildUpcomingHighlightsQuery,
} from '@/features/discovery/api/discovery-query-presets';
import type { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';
import type { DiscoveryCursor } from '@/features/discovery/domain/discovery-pagination-types';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

import type { HomeFeedLoadResult, HomeFeedLocationContext, HomeFeedSectionDefinition } from './home-feed-types';
import { trackHomeFeedTelemetry } from './home-feed-telemetry';

const inflightRequests = new Map<string, Promise<HomeFeedLoadResult>>();

function mapResponseItems(
  items: Array<{ event: EventDisplayModel }>,
): EventDisplayModel[] {
  return items.map((item) => item.event);
}

async function executeSectionQuery(
  platform: DiscoveryQueryPlatform,
  section: HomeFeedSectionDefinition,
  location: HomeFeedLocationContext,
  options: { limit: number; cursor?: DiscoveryCursor },
): Promise<HomeFeedLoadResult> {
  const startedAt = Date.now();
  const baseParams = {
    city: location.city,
    limit: options.limit,
    cursor: options.cursor,
  };

  let response;
  switch (section.preset) {
    case 'trending':
      response = await platform.queryTrending(baseParams);
      break;
    case 'today':
      response = await platform.queryToday(baseParams);
      break;
    case 'weekend':
      response = await platform.queryWeekend(baseParams);
      break;
    case 'this-week':
      response = await platform.queryThisWeek(baseParams);
      break;
    case 'next-week':
      response = await platform.queryNextWeek(baseParams);
      break;
    case 'nearby':
      if (location.latitude === undefined || location.longitude === undefined) {
        return { events: [], hasMore: false, totalMatched: 0, durationMs: Date.now() - startedAt };
      }
      response = await platform.queryNearby({
        ...baseParams,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusKm: location.radiusKm ?? 50,
      });
      break;
    case 'newly-added':
      response = await platform.queryNewlyAdded(baseParams);
      break;
    case 'upcoming-highlights':
      response = await platform.queryUpcomingHighlights(baseParams);
      break;
    case 'genre':
      if (!section.genreLabel) {
        return { events: [], hasMore: false, totalMatched: 0, durationMs: Date.now() - startedAt };
      }
      response = await platform.filterEvents(
        buildGenreQuery(section.genreLabel, baseParams),
      );
      break;
    default:
      return { events: [], hasMore: false, totalMatched: 0, durationMs: Date.now() - startedAt };
  }

  if (!response.ok) {
    const message =
      'error' in response && response.error && typeof response.error === 'object' && 'message' in response.error
        ? String(response.error.message)
        : 'Discovery request failed.';
    throw new Error(message);
  }

  return {
    events: mapResponseItems(response.data.items),
    hasMore: response.pagination?.hasMore ?? false,
    cursor: response.pagination?.nextCursor,
    totalMatched: response.pagination?.totalMatched ?? response.data.items.length,
    durationMs: response.meta.performance.durationMs ?? Date.now() - startedAt,
  };
}

function buildRequestKey(
  section: HomeFeedSectionDefinition,
  location: HomeFeedLocationContext,
  cursor?: DiscoveryCursor,
): string {
  return buildDiscoveryCacheKey({
    version: DEFAULT_DISCOVERY_API_VERSION,
    route: `home.feed.${section.id}`,
    params: {
      city: location.city,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: location.radiusKm,
      cursor: cursor?.encoded,
      limit: section.previewLimit,
      genre: section.genreLabel,
    },
  });
}

export async function loadHomeFeedSection(
  section: HomeFeedSectionDefinition,
  location: HomeFeedLocationContext,
  options: { limit?: number; cursor?: DiscoveryCursor; bypassCache?: boolean } = {},
): Promise<HomeFeedLoadResult> {
  if (section.requiresLocation && (location.latitude === undefined || location.longitude === undefined)) {
    return { events: [], hasMore: false, totalMatched: 0, durationMs: 0 };
  }

  const limit = options.limit ?? section.previewLimit;
  const requestKey = buildRequestKey(section, location, options.cursor);

  if (!options.bypassCache && inflightRequests.has(requestKey)) {
    return inflightRequests.get(requestKey)!;
  }

  trackHomeFeedTelemetry('section_load_start', { sectionId: section.id });

  const platform = getDiscoveryQueryPlatform();
  const request = executeSectionQuery(platform, section, location, {
    limit,
    cursor: options.cursor,
  })
    .then((result) => {
      trackHomeFeedTelemetry('section_load_complete', {
        sectionId: section.id,
        durationMs: result.durationMs,
        itemCount: result.events.length,
      });
      return result;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Section load failed.';
      trackHomeFeedTelemetry('section_load_error', { sectionId: section.id, error: message });
      throw error;
    })
    .finally(() => {
      inflightRequests.delete(requestKey);
    });

  inflightRequests.set(requestKey, request);
  return request;
}

export async function loadHomeFeedSectionsParallel(
  sections: HomeFeedSectionDefinition[],
  location: HomeFeedLocationContext,
  options: { bypassCache?: boolean } = {},
): Promise<Record<string, HomeFeedLoadResult>> {
  trackHomeFeedTelemetry('feed_load_start');
  const startedAt = Date.now();

  const entries = await Promise.all(
    sections.map(async (section) => {
      try {
        const result = await loadHomeFeedSection(section, location, options);
        return [section.id, result] as const;
      } catch {
        return [
          section.id,
          { events: [], hasMore: false, totalMatched: 0, durationMs: 0 },
        ] as const;
      }
    }),
  );

  trackHomeFeedTelemetry('feed_load_complete', {
    durationMs: Date.now() - startedAt,
    itemCount: entries.reduce((sum, [, result]) => sum + result.events.length, 0),
  });

  return Object.fromEntries(entries);
}

export function clearHomeFeedRequestCache(): void {
  inflightRequests.clear();
}

export async function loadMoreHomeFeedSection(
  section: HomeFeedSectionDefinition,
  location: HomeFeedLocationContext,
  cursor: DiscoveryCursor,
  limit = 24,
): Promise<HomeFeedLoadResult> {
  trackHomeFeedTelemetry('section_pagination', { sectionId: section.id });
  return loadHomeFeedSection(section, location, { limit, cursor, bypassCache: true });
}
