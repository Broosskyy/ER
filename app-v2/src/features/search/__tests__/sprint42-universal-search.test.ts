import { describe, expect, it } from 'vitest';

import { discoveryCitiesMatch } from '@/features/location/normalize-discovery-city';
import { mapEventFiltersToDiscoveryQuery } from '@/features/discovery/utils/map-event-filters-to-discovery-query';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import {
  DEFAULT_SEARCH_LOCATION_SCOPE,
  GLOBAL_CITY_FILTER_VALUE,
  resolveEffectiveLocationScope,
  shouldApplyCityFilter,
  shouldApplyNearbyFilter,
} from '@/features/search/domain/location-scope';
import { matchesCity } from '@/features/search/utils/filter-events';
import type { Event } from '@/features/events/types/event';

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Night Shift',
    description: 'Description',
    startDateTime: '2026-08-01T20:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Bootshaus',
    city: 'Leipzig',
    country: 'Germany',
    genres: ['Techno'],
    artists: ['WESTBAM'],
    organizer: 'Boiler Room',
    source: 'demo',
    sourceEventId: 'event-1',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Phase 4.2 location scope and search defaults', () => {
  it('defaults search filters to global scope without implicit city', () => {
    expect(DEFAULT_EVENT_FILTERS.locationScope).toBe(DEFAULT_SEARCH_LOCATION_SCOPE);
    expect(DEFAULT_EVENT_FILTERS.city).toBe(GLOBAL_CITY_FILTER_VALUE);
  });

  it('does not apply city filter for global search', () => {
    const query = mapEventFiltersToDiscoveryQuery(DEFAULT_EVENT_FILTERS);
    expect(query.entities?.city).toBeUndefined();
    expect(query.location).toBeUndefined();
    expect(shouldApplyCityFilter(DEFAULT_EVENT_FILTERS)).toBe(false);
  });

  it('applies explicit city filter only when location scope is city', () => {
    const filters = {
      ...DEFAULT_EVENT_FILTERS,
      city: 'Berlin',
      locationScope: 'city' as const,
    };

    const query = mapEventFiltersToDiscoveryQuery(filters);
    expect(query.entities?.city).toBe('Berlin');
    expect(resolveEffectiveLocationScope(filters)).toBe('city');
  });

  it('applies nearby scope only with explicit distance filter', () => {
    const filters = {
      ...DEFAULT_EVENT_FILTERS,
      distance: '25' as const,
      locationScope: 'nearby' as const,
    };

    expect(shouldApplyNearbyFilter(filters)).toBe(true);
    const query = mapEventFiltersToDiscoveryQuery(filters, {
      latitude: 50.94,
      longitude: 6.96,
    });
    expect(query.location?.radiusKm).toBe(25);
    expect(query.entities?.city).toBeUndefined();
  });

  it('matches city aliases accent-insensitively', () => {
    expect(discoveryCitiesMatch('Köln', 'Koeln')).toBe(true);
    expect(discoveryCitiesMatch('Köln', 'Cologne')).toBe(true);
    expect(matchesCity(event({ city: 'Köln' }), 'Koeln', 'city')).toBe(true);
    expect(matchesCity(event({ city: 'Leipzig' }), 'Köln', 'global')).toBe(true);
  });

  it('keeps global search from hiding events outside a home city', () => {
    expect(matchesCity(event(), 'Köln', 'global')).toBe(true);
    expect(
      mapEventFiltersToDiscoveryQuery({
        ...DEFAULT_EVENT_FILTERS,
        query: 'WESTBAM',
      }).entities?.city,
    ).toBeUndefined();
  });

  it('clears location filters when resetting to defaults', () => {
    const cleared = DEFAULT_EVENT_FILTERS;
    expect(cleared.city).toBe('');
    expect(cleared.locationScope).toBe('global');
    expect(cleared.distance).toBe('any');
  });
});
