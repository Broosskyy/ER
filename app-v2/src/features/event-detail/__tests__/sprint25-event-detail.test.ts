import { describe, expect, it, vi, beforeEach } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import type { Event } from '@/features/events/types/event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  clearEventDetailCache,
  loadEventDetail,
  loadSimilarEvents,
} from '@/features/event-detail/feed/discovery-event-detail-client';
import {
  getRecentEventDetailTelemetry,
  resetEventDetailTelemetryForTests,
  trackEventDetailTelemetry,
} from '@/features/event-detail/feed/event-detail-telemetry';
import { resolveEventNoticeType } from '@/features/events/status/event-status-resolver';
import { buildSimilarEventsQuery } from '@/features/discovery/api/discovery-query-presets';

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
    source: 'supabase',
    sourceEventId: 'event-1',
    status: 'published',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    publishedAt: '2026-05-01T00:00:00.000Z',
    priceText: 'Kostenlos',
    ticketUrl: 'https://example.com/tickets',
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
    startsAt: event.startDateTime,
    startDateTime: event.startDateTime,
    timezone: event.timezone,
    status: event.status,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    lifecycleNotices: event.lifecycleHints,
    previousVenue: event.previousVenue,
    lifecycleStatus: event.cancelledAt ? 'cancelled' : 'scheduled',
  } as EventDisplayModel;
}

vi.mock('@/features/discovery/discovery-runtime', () => ({
  getDiscoveryQueryPlatform: vi.fn(),
}));

import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';

function createPlatform(events: Event[]) {
  const clock = new FixedClock(new Date('2026-05-24T12:00:00.000Z'));
  const engine = new DiscoveryEngine({
    eventSource: new StaticDiscoveryEventSource(events),
    clock,
    displayMapper: mockDisplayModel,
  });
  return new DiscoveryQueryPlatform({
    discoveryApi: new DiscoveryApiService(engine),
    entityReaders: {
      getEventById: (id) => events.find((event) => event.id === id),
      getVenueById: async () => null,
      getOrganizerById: async () => null,
      getFestivalById: async () => null,
    },
    mapEventToDisplay: mockDisplayModel,
    createRequestId: () => 'test',
  });
}

describe('Sprint 25 event detail experience', () => {
  beforeEach(() => {
    clearEventDetailCache();
    resetEventDetailTelemetryForTests();
    vi.clearAllMocks();
  });

  it('loads event detail through discovery query platform', async () => {
    const platform = createPlatform([createEvent()]);
    vi.mocked(getDiscoveryQueryPlatform).mockReturnValue(platform);

    const result = await loadEventDetail('event-1');
    expect(result.event.title).toBe('Techno Night');
    expect(result.fromCache).toBe(false);
  });

  it('uses cache on second load', async () => {
    const platform = createPlatform([createEvent()]);
    vi.mocked(getDiscoveryQueryPlatform).mockReturnValue(platform);

    await loadEventDetail('event-1');
    const cached = await loadEventDetail('event-1');
    expect(cached.fromCache).toBe(true);
  });

  it('loads similar events excluding current event', async () => {
    const events = [
      createEvent(),
      createEvent({ id: 'event-2', title: 'Other Techno', slug: 'event-2' }),
      createEvent({ id: 'event-3', title: 'House Night', slug: 'event-3', genres: ['House'] }),
    ];
    const platform = createPlatform(events);
    vi.mocked(getDiscoveryQueryPlatform).mockReturnValue(platform);

    const detail = await loadEventDetail('event-1');
    const similar = await loadSimilarEvents(detail.event);
    expect(similar.events.some((item) => item.id === 'event-1')).toBe(false);
    expect(similar.events.length).toBeGreaterThan(0);
  });

  it('builds similar events discovery query', () => {
    const query = buildSimilarEventsQuery({
      genres: ['Techno'],
      city: 'Köln',
      venueId: 'venue-1',
    });
    expect(query.surface).toBe('similar_events');
    expect(query.entities?.genres).toEqual(['Techno']);
  });

  it('resolves lifecycle venue changed notice', () => {
    const event = mockDisplayModel(
      createEvent({
        lifecycleHints: ['venue_changed'],
        previousVenue: 'Alte Halle',
      }),
    );
    expect(resolveEventNoticeType(event)).toBe('venue_changed');
  });

  it('resolves cancelled lifecycle notice', () => {
    const event = mockDisplayModel(createEvent({ cancelledAt: '2026-05-20T00:00:00.000Z' }));
    event.lifecycleStatus = 'cancelled';
    expect(resolveEventNoticeType(event)).toBe('cancelled');
  });

  it('records internal event detail telemetry', () => {
    trackEventDetailTelemetry('detail_opened', { eventId: 'event-1' });
    trackEventDetailTelemetry('detail_ticket_cta', { eventId: 'event-1' });
    const events = getRecentEventDetailTelemetry();
    expect(events).toHaveLength(2);
    expect(events[0]?.name).toBe('detail_opened');
  });
});
