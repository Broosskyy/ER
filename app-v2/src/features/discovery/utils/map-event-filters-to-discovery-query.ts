import {
  filterConfig,
  getActiveDistanceOptions,
  getActiveFestivalOptions,
  getActiveOrganizerOptions,
  getActivePriceOptions,
  getActiveVenueEnvironmentOptions,
  getActiveVenueOptions,
} from '@/features/search/config/filter-config';
import type { EventFilters } from '@/features/search/constants';

import type { DiscoveryQuery } from '../domain/discovery-query-types';

const DATE_RANGE_TO_PRESET: Record<
  EventFilters['dateRange'],
  DiscoveryQuery['date']
> = {
  'all-dates': { preset: 'all' },
  today: { preset: 'today' },
  'this-weekend': { preset: 'this-weekend' },
  upcoming: { preset: 'upcoming' },
};

const SORT_TO_DISCOVERY: Record<EventFilters['sortBy'], DiscoveryQuery['sortBy']> = {
  recommended: 'relevance',
  date: 'date',
  alphabetical: 'alphabetical',
  distance: 'distance',
  newest: 'newest',
  trending: 'popularity',
};

function resolveRadiusKm(distance: EventFilters['distance']): number | undefined {
  const option = getActiveDistanceOptions().find((item) => item.id === distance);
  return option?.radiusKm ?? undefined;
}

function resolvePriceFilter(price: EventFilters['price']): DiscoveryQuery['price'] | undefined {
  const option = getActivePriceOptions().find((item) => item.id === price);
  if (!option || option.id === 'any') {
    return undefined;
  }

  return {
    freeOnly: option.freeOnly,
    maxPriceEur: option.maxPriceEur,
  };
}

function resolveVenueEnvironment(
  venueEnvironment: EventFilters['venueEnvironment'],
): DiscoveryQuery['venueEnvironment'] | undefined {
  const option = getActiveVenueEnvironmentOptions().find((item) => item.id === venueEnvironment);
  if (!option || option.id === 'any') {
    return undefined;
  }

  return {
    indoor: option.indoor,
    outdoor: option.outdoor,
  };
}

function resolveEntityId(
  entityId: string | null,
  options: ReturnType<typeof getActiveVenueOptions>,
): string | undefined {
  if (!entityId) {
    return undefined;
  }

  const option = options.find((item) => item.id === entityId);
  return option?.entityId ?? undefined;
}

function resolveDateFilter(filters: EventFilters): DiscoveryQuery['date'] {
  if (filters.dateStartAt || filters.dateEndAt) {
    return {
      preset: 'custom',
      startAt: filters.dateStartAt ?? undefined,
      endAt: filters.dateEndAt ?? undefined,
    };
  }

  return DATE_RANGE_TO_PRESET[filters.dateRange];
}

export function mapEventFiltersToDiscoveryQuery(
  filters: EventFilters,
  options: {
    surface?: DiscoveryQuery['surface'];
    limit?: number;
    cursor?: DiscoveryQuery['cursor'];
    latitude?: number;
    longitude?: number;
  } = {},
): DiscoveryQuery {
  const radiusKm = resolveRadiusKm(filters.distance);
  const hasLocation = options.latitude !== undefined && options.longitude !== undefined;

  return {
    surface: options.surface ?? 'search_events',
    search: filters.query.trim()
      ? { text: filters.query.trim(), mode: 'fuzzy', locale: 'de' }
      : undefined,
    date: resolveDateFilter(filters),
    entities: {
      city: filters.city || undefined,
      genres: filters.genres.length > 0 ? [...filters.genres] : undefined,
      venueId: resolveEntityId(filters.venueId, getActiveVenueOptions()),
      organizerId: resolveEntityId(filters.organizerId, getActiveOrganizerOptions()),
      festivalId: resolveEntityId(filters.festivalId, getActiveFestivalOptions()),
    },
    location:
      hasLocation || radiusKm
        ? {
            latitude: options.latitude,
            longitude: options.longitude,
            city: filters.city || undefined,
            radiusKm,
          }
        : undefined,
    price: resolvePriceFilter(filters.price),
    venueEnvironment: resolveVenueEnvironment(filters.venueEnvironment),
    sortBy: SORT_TO_DISCOVERY[filters.sortBy],
    limit: options.limit,
    cursor: options.cursor,
    diversify: filters.sortBy === 'recommended' || filters.sortBy === 'trending',
  };
}

export function isDefaultDiscoveryBrowseFilters(filters: EventFilters): boolean {
  return (
    filters.query.trim().length === 0 &&
    filters.dateRange === 'all-dates' &&
    filters.genres.length === 0 &&
    filters.city === filterConfig.cityOptions.find((city) => city.id === filterConfig.defaultCityId)?.value &&
    filters.sortBy === 'recommended' &&
    filters.distance === 'any' &&
    filters.price === 'any' &&
    filters.venueEnvironment === 'any' &&
    !filters.venueId &&
    !filters.organizerId &&
    !filters.festivalId &&
    !filters.dateStartAt &&
    !filters.dateEndAt
  );
}
