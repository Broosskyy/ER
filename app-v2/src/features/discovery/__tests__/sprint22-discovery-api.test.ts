import { describe, expect, it } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { DiscoveryApiRouter } from '@/features/discovery/api/discovery-api-router';
import { DiscoveryApiError } from '@/features/discovery/api/domain/discovery-api-errors';
import { negotiateDiscoveryApiVersion } from '@/features/discovery/api/domain/discovery-api-version';
import { DiscoveryHttpAdapter } from '@/features/discovery/api/http/discovery-http-adapter';
import { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import { buildDiscoveryCacheKey } from '@/features/discovery/api/cache/discovery-cache-key';
import { validateDiscoveryQuery } from '@/features/discovery/api/validation/discovery-api-validator';
import { planDiscoveryQuery } from '@/features/discovery/query/discovery-query-planner';
import { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { parseDiscoveryCursor } from '@/features/discovery/pagination/discovery-cursor';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';

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

function createPlatform(events: Event[]) {
  const clock = new FixedClock(new Date('2026-05-24T12:00:00.000Z'));
  const engine = new DiscoveryEngine({
    eventSource: new StaticDiscoveryEventSource(events),
    clock,
    displayMapper: mockDisplayModel,
  });
  const api = new DiscoveryApiService(engine);
  const platform = new DiscoveryQueryPlatform({
    discoveryApi: api,
    entityReaders: {
      getEventById: (id) => events.find((event) => event.id === id),
      getVenueById: async () => null,
      getOrganizerById: async () => null,
      getFestivalById: async () => null,
    },
    mapEventToDisplay: mockDisplayModel,
    createRequestId: () => 'test-request',
  });
  return { platform, api, engine };
}

describe('Sprint 22 discovery API', () => {
  it('negotiates API versions', () => {
    expect(negotiateDiscoveryApiVersion('v1').resolved).toBe('v1');
    expect(negotiateDiscoveryApiVersion('v9').resolved).toBe('v1');
  });

  it('returns unified response envelope for today route', async () => {
    const { platform } = createPlatform([
      createEvent(),
      createEvent({ id: 'event-2', startDateTime: '2026-05-25T14:00:00.000Z' }),
    ]);

    const response = await platform.queryToday({ limit: 10 });
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.meta.version).toBe('v1');
      expect(response.meta.requestId).toBe('test-request');
      expect(response.meta.performance.durationMs).toBeGreaterThanOrEqual(0);
      expect(response.pagination?.hasMore).toBeDefined();
      expect(response.data.items.length).toBeGreaterThan(0);
    }
  });

  it('rejects invalid cursor', () => {
    expect(() =>
      validateDiscoveryQuery({
        surface: 'search_events',
        cursor: { encoded: 'not-a-valid-cursor' },
      }),
    ).toThrow(DiscoveryApiError);
  });

  it('routes nearby requests through platform', async () => {
    const { platform } = createPlatform([
      createEvent(),
      createEvent({ id: 'far', latitude: 52.52, longitude: 13.405, city: 'Berlin' }),
    ]);
    const router = new DiscoveryApiRouter(platform);
    const result = await router.handle<{ items: Array<{ event: { id: string } }> }>({
      route: 'events.nearby',
      params: { latitude: 50.94, longitude: 6.96, radiusKm: 50 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
    }
  });

  it('returns structured error for missing event', async () => {
    const { platform } = createPlatform([createEvent()]);
    const router = new DiscoveryApiRouter(platform);
    const result = await router.handle({ route: 'events.detail', params: { id: 'missing' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.meta.requestId).toBeDefined();
    }
  });

  it('handles HTTP adapter requests', async () => {
    const { platform } = createPlatform([createEvent()]);
    const http = new DiscoveryHttpAdapter(platform);
    const response = await http.handle({
      method: 'GET',
      path: '/v1/discovery/events/today',
      headers: { 'x-er-api-version': 'v1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers['X-ER-API-Version']).toBe('v1');
    expect(response.body.ok).toBe(true);
  });

  it('plans index usage for entity filters', () => {
    const plan = planDiscoveryQuery({
      surface: 'venue_events',
      entities: { venueId: 'venue-1', city: 'Köln' },
    });
    expect(plan.estimatedIndexUse).toContain('events_discovery_venue_start_idx');
    expect(plan.estimatedIndexUse).toContain('events_discovery_city_start_idx');
  });

  it('builds stable cache keys', () => {
    const key = buildDiscoveryCacheKey({
      version: 'v1',
      route: 'events.today',
      params: { city: 'Köln' },
    });
    expect(key).toContain('v=v1');
    expect(key).toContain('route=events.today');
  });

  it('supports cursor pagination via API', async () => {
    const { platform } = createPlatform([
      createEvent({ id: 'a', startDateTime: '2026-05-24T14:00:00.000Z' }),
      createEvent({ id: 'b', startDateTime: '2026-05-24T15:00:00.000Z' }),
      createEvent({ id: 'c', startDateTime: '2026-05-24T16:00:00.000Z' }),
    ]);

    const first = await platform.filterEvents({
      surface: 'events_list',
      date: { preset: 'today' },
      sortBy: 'date',
      limit: 2,
    });
    expect(first.pagination?.hasMore).toBe(true);
    const cursor = first.pagination?.nextCursor;
    expect(cursor).toBeDefined();
    expect(parseDiscoveryCursor(cursor)).not.toBeNull();

    const second = await platform.filterEvents({
      surface: 'events_list',
      date: { preset: 'today' },
      sortBy: 'date',
      limit: 2,
      cursor,
    });
    expect(second.data.items.length).toBe(1);
  });
});
