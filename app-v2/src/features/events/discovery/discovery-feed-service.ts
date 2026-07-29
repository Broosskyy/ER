import type { Clock } from '@/core/clock/clock';
import { eventRepository } from '@/data/repositories/registry';
import { getDiscoveryEngine } from '@/features/discovery/discovery-runtime';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { mapEventFiltersToDiscoveryQuery } from '@/features/discovery/utils/map-event-filters-to-discovery-query';
import type { DiscoverySurface as RankingSurface } from '@/features/events/discovery/discovery-ranking-service';
import {
  toEventDisplayModel,
  type EventDisplayModel,
} from '@/features/events/formatting/display-event';
import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/features/search/constants';

import { getDiscoverablePublishedEvents as getDiscoverableEventsFromRepository } from './discovery-feed-helpers';

export interface DiscoveryFeedOptions {
  surface: RankingSurface;
  filters?: EventFilters;
  city?: string;
  selectedGenres?: string[];
  includePast?: boolean;
  clock?: Clock;
  limit?: number;
}

export function getDiscoveryFeedEvents(options: DiscoveryFeedOptions): EventDisplayModel[] {
  const filters = options.filters ?? DEFAULT_EVENT_FILTERS;
  const query = mapEventFiltersToDiscoveryQuery(filters, {
    surface: options.surface,
    limit: options.limit ?? 10_000,
  });

  if (options.city) {
    query.entities = { ...query.entities, city: options.city };
  }
  if (options.selectedGenres?.length) {
    query.entities = { ...query.entities, genres: options.selectedGenres };
  }
  if (options.includePast) {
    query.date = { ...query.date, includePast: true, preset: 'all' };
  }

  const engine = options.clock
    ? new DiscoveryEngine({
        eventSource: new InMemoryDiscoveryEventSource(),
        clock: options.clock,
        resolveCanonicalId: (eventId) => eventRepository.resolveCanonicalId(eventId),
        displayMapper: toEventDisplayModel,
      })
    : getDiscoveryEngine();

  const result = engine.queryDisplayModelsSync(query);
  return result.items.map((item) => item.event);
}

export { getDiscoverableEventsFromRepository as getDiscoverablePublishedEvents };
