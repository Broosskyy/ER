import { describe, expect, it, vi, beforeEach } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import { mapEventFiltersToDiscoveryQuery } from '@/features/discovery/utils/map-event-filters-to-discovery-query';
import type { Event } from '@/features/events/types/event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import {
  clearDiscoverySearchRequestCache,
  loadDiscoverySearchResults,
} from '@/features/search/feed/discovery-search-client';
import {
  getRecentSearchTelemetry,
  resetSearchTelemetryForTests,
  trackSearchTelemetry,
} from '@/features/search/feed/search-telemetry';
import { getTrendingSearches } from '@/features/search/config/trending-searches';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Techno Night',
    description: 'Warehouse party',
    startDateTime: '2026-05-24T14:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Warehouse',
    city: 'Köln',
    country: 'Germany',
    latitude: 50.94,
    longitude: 6.96,
    genres: ['Techno'],
    artists: ['DJ Alpha'],
    organizer: 'ER Collective',
    organizerId: 'org-1',
    venueId: 'venue-1',
    venueType: 'warehouse',
    source: 'supabase',
    sourceEventId: 'event-1',
    status: 'published',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    publishedAt: '2026-05-01T00:00:00.000Z',
    priceText: 'Kostenlos',
    ...overrides,
  };
}

class StaticDiscoveryEventSource extends InMemoryDiscoveryEventSource {
  constructor(private readonly events: Event[]) {
    super();
  }

  listDiscoverableEvents() {
    return this.events;
  }
}

function mockDisplayModel(event: Event): EventDisplayModel {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    image: { uri: '' },
    date: 'Today',
    startTime: '22:00',
    venue: event.venue,
    city: event.city,
    genres: event.genres,
    artists: event.artists,
    source: event.source,
    sourceLabel: event.source,
    isUpcoming: true,
    isThisWeek: true,
    isThisMonth: true,
    hasCoordinates: true,
    lifecycleStatus: 'scheduled',
    startsAt: event.startDateTime,
    startDateTime: event.startDateTime,
    timezone: event.timezone,
    status: event.status,
    priceText: event.priceText,
  } as EventDisplayModel;
}

vi.mock('@/features/discovery/discovery-runtime', () => ({
  getDiscoveryQueryPlatform: vi.fn(),
}));

import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';

describe('Sprint 24 search experience', () => {
  beforeEach(() => {
    clearDiscoverySearchRequestCache();
    resetSearchTelemetryForTests();
    vi.clearAllMocks();
  });

  it('maps advanced filters to discovery query', () => {
    const query = mapEventFiltersToDiscoveryQuery(
      {
        ...DEFAULT_EVENT_FILTERS,
        query: 'techno',
        genres: ['techno'],
        distance: '25',
        locationScope: 'nearby',
        price: 'free',
        venueEnvironment: 'indoor',
        sortBy: 'trending',
      },
      { latitude: 50.94, longitude: 6.96 },
    );

    expect(query.search?.text).toBe('techno');
    expect(query.entities?.genres).toEqual(['techno']);
    expect(query.location?.radiusKm).toBe(25);
    expect(query.price?.freeOnly).toBe(true);
    expect(query.venueEnvironment?.indoor).toBe(true);
    expect(query.sortBy).toBe('popularity');
  });

  it('loads search results through discovery query platform', async () => {
    const clock = new FixedClock(new Date('2026-05-24T12:00:00.000Z'));
    const engine = new DiscoveryEngine({
      eventSource: new StaticDiscoveryEventSource([createEvent()]),
      clock,
      displayMapper: mockDisplayModel,
    });
    const platform = new DiscoveryQueryPlatform({
      discoveryApi: new DiscoveryApiService(engine),
      entityReaders: {
        getEventById: () => undefined,
        getVenueById: async () => null,
        getOrganizerById: async () => null,
        getFestivalById: async () => null,
      },
      mapEventToDisplay: mockDisplayModel,
      createRequestId: () => 'test',
    });
    vi.mocked(getDiscoveryQueryPlatform).mockReturnValue(platform);

    const result = await loadDiscoverySearchResults({
      ...DEFAULT_EVENT_FILTERS,
      query: 'Techno',
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toBe('Techno Night');
  });

  it('defines trending searches catalogue', () => {
    expect(getTrendingSearches().length).toBeGreaterThanOrEqual(3);
  });

  it('records internal search telemetry', () => {
    trackSearchTelemetry('search_start', { query: 'techno', filterCount: 1 });
    trackSearchTelemetry('search_complete', { query: 'techno', durationMs: 18, resultCount: 4 });
    const events = getRecentSearchTelemetry();
    expect(events).toHaveLength(2);
    expect(events[0]?.name).toBe('search_start');
    expect(events[1]?.resultCount).toBe(4);
  });
});
