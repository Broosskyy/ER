import { describe, expect, it, vi, beforeEach } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import {
  getVisibleHomeFeedSections,
  HOME_FEED_SECTIONS,
} from '@/features/home/feed/home-feed-section-config';
import { clearHomeFeedRequestCache } from '@/features/home/feed/discovery-feed-client';
import {
  getRecentHomeFeedTelemetry,
  resetHomeFeedTelemetryForTests,
  trackHomeFeedTelemetry,
} from '@/features/home/feed/home-feed-telemetry';
import { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import type { Event } from '@/features/events/types/event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

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
    imageUrl: 'https://example.com/flyer.jpg',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    publishedAt: '2026-05-01T00:00:00.000Z',
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
  } as EventDisplayModel;
}

vi.mock('@/features/discovery/discovery-runtime', () => ({
  getDiscoveryQueryPlatform: vi.fn(),
}));

import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';
import { loadHomeFeedSection } from '@/features/home/feed/discovery-feed-client';

describe('Sprint 23 home feed', () => {
  beforeEach(() => {
    clearHomeFeedRequestCache();
    resetHomeFeedTelemetryForTests();
    vi.clearAllMocks();
  });

  it('defines nine home feed sections with large rails interleaved by compact lists', () => {
    const visible = getVisibleHomeFeedSections();
    expect(visible).toHaveLength(9);
    expect(visible.map((section) => section.preset)).toEqual([
      'trending',
      'today',
      'upcoming-highlights',
      'this-week',
      'weekend',
      'upcoming-highlights',
      'next-week',
      'newly-added',
      'nearby',
    ]);
    expect(visible.filter((section) => section.layout === 'rail')).toHaveLength(3);
    expect(visible.filter((section) => section.layout === 'list')).toHaveLength(6);
  });

  it('loads section data through discovery query platform', async () => {
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

    const section = HOME_FEED_SECTIONS.find((item) => item.id === 'today')!;
    const result = await loadHomeFeedSection(section, { city: 'Köln' });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toBe('Techno Night');
  });

  it('skips nearby section without location', async () => {
    const platform = {
      queryNearby: vi.fn(),
    } as unknown as DiscoveryQueryPlatform;
    vi.mocked(getDiscoveryQueryPlatform).mockReturnValue(platform);

    const section = HOME_FEED_SECTIONS.find((item) => item.id === 'nearby')!;
    const result = await loadHomeFeedSection(section, { city: 'Köln' });
    expect(result.events).toHaveLength(0);
    expect(platform.queryNearby).not.toHaveBeenCalled();
  });

  it('records internal telemetry events', () => {
    trackHomeFeedTelemetry('feed_load_start');
    trackHomeFeedTelemetry('section_load_complete', { sectionId: 'today', durationMs: 12, itemCount: 3 });
    const events = getRecentHomeFeedTelemetry();
    expect(events).toHaveLength(2);
    expect(events[0]?.name).toBe('feed_load_start');
    expect(events[1]?.sectionId).toBe('today');
  });
});
