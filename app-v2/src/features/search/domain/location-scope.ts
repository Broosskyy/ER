import type { EventFilters } from '@/features/search/constants';

/** Explicit location scope for discovery surfaces. */
export type LocationScope = 'global' | 'city' | 'nearby' | 'map_bounds';

export const DEFAULT_SEARCH_LOCATION_SCOPE: LocationScope = 'global';
export const DEFAULT_HOME_LOCATION_SCOPE: LocationScope = 'city';

/** Empty city value means no city restriction (global search). */
export const GLOBAL_CITY_FILTER_VALUE = '';

export type SearchEntityTab = 'all' | 'events' | 'artists' | 'venues' | 'organizers';

export const DEFAULT_SEARCH_ENTITY_TAB: SearchEntityTab = 'all';

export function isGlobalLocationScope(scope: LocationScope | undefined): boolean {
  return !scope || scope === 'global';
}

export function resolveEffectiveLocationScope(filters: EventFilters): LocationScope {
  if (filters.locationScope) {
    return filters.locationScope;
  }

  if (filters.distance !== 'any') {
    return 'nearby';
  }

  if (filters.city.trim()) {
    return 'city';
  }

  return DEFAULT_SEARCH_LOCATION_SCOPE;
}

export function shouldApplyCityFilter(filters: EventFilters): boolean {
  const scope = resolveEffectiveLocationScope(filters);
  return scope === 'city' || scope === 'map_bounds';
}

export function shouldApplyNearbyFilter(filters: EventFilters): boolean {
  return resolveEffectiveLocationScope(filters) === 'nearby';
}

export function resolveSearchCityFilter(filters: EventFilters): string | undefined {
  if (!shouldApplyCityFilter(filters)) {
    return undefined;
  }

  const city = filters.city.trim();
  return city || undefined;
}

export interface SearchLocationCoordinates {
  latitude?: number;
  longitude?: number;
}

export function resolveSearchLocationCoordinates(
  filters: EventFilters,
  coordinates: SearchLocationCoordinates,
): SearchLocationCoordinates {
  if (!shouldApplyNearbyFilter(filters)) {
    return {};
  }

  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}
