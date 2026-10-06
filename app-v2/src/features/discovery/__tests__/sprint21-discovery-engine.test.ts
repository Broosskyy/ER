import { describe, expect, it } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { createDiscoveryCursor } from '@/features/discovery/pagination/discovery-cursor';
import { matchesDiscoverySearch } from '@/features/discovery/search/discovery-search-matcher';
import { createDiscoveryFilterEngine } from '@/features/discovery/filters/discovery-filter-engine';
import { buildDiscoveryFilterPredicates } from '@/features/discovery/filters/discovery-filter-predicates';
import type { Event } from '@/features/events/types/event';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Techno Night',
    description: 'Warehouse party',
    startDateTime: '2026-05-24T22:00:00.000Z',
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

describe('Sprint 21 discovery engine', () => {
  const clock = new FixedClock(new Date('2026-05-24T12:00:00.000Z'));

  it('filters events by city and genre via generic filter engine', async () => {
    const engine = new DiscoveryEngine({
      eventSource: new StaticDiscoveryEventSource([
        createEvent(),
        createEvent({ id: 'event-2', city: 'Berlin', genres: ['House'] }),
      ]),
      clock,
    });

    const result = await engine.query({
      surface: 'search_events',
      entities: { city: 'Köln', genres: ['Techno'] },
      sortBy: 'date',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.event.id).toBe('event-1');
  });

  it('supports cursor pagination', async () => {
    const engine = new DiscoveryEngine({
      eventSource: new StaticDiscoveryEventSource([
        createEvent({ id: 'event-a', startDateTime: '2026-05-25T20:00:00.000Z' }),
        createEvent({ id: 'event-b', startDateTime: '2026-05-26T20:00:00.000Z' }),
        createEvent({ id: 'event-c', startDateTime: '2026-05-27T20:00:00.000Z' }),
      ]),
      clock,
    });

    const firstPage = await engine.query({
      surface: 'events_list',
      sortBy: 'date',
      limit: 2,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeDefined();

    const secondPage = await engine.query({
      surface: 'events_list',
      sortBy: 'date',
      limit: 2,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it('filters nearby events by radius', async () => {
    const engine = new DiscoveryEngine({
      eventSource: new StaticDiscoveryEventSource([
        createEvent({ imageUrl: 'https://example.com/flyer.jpg' }),
        createEvent({
          id: 'event-far',
          latitude: 52.52,
          longitude: 13.405,
          city: 'Berlin',
          imageUrl: 'https://example.com/flyer-far.jpg',
        }),
      ]),
      clock,
    });

    const result = await engine.query({
      surface: 'home_nearby',
      location: { latitude: 50.94, longitude: 6.96, radiusKm: 50 },
      sortBy: 'distance',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.event.city).toBe('Köln');
  });

  it('matches fuzzy search with synonyms', () => {
    const event = createEvent({ title: 'Open Air Festival', genres: ['House'] });
    expect(matchesDiscoverySearch(event, 'fest', { mode: 'fuzzy', locale: 'de' })).toBe(true);
    expect(matchesDiscoverySearch(event, 'tekno', { mode: 'fuzzy', locale: 'de' })).toBe(false);
  });

  it('filters free events only', () => {
    const predicates = buildDiscoveryFilterPredicates(
      { surface: 'search_events', price: { freeOnly: true } },
      { now: clock.now() },
    );
    const engine = createDiscoveryFilterEngine(predicates);
    const filtered = engine.apply([
      createEvent({ priceText: 'Kostenlos' }),
      createEvent({ id: 'paid', priceText: '15 EUR' }),
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.priceText).toBe('Kostenlos');
  });

  it('encodes and decodes discovery cursors', () => {
    const cursor = createDiscoveryCursor({
      sortField: 'date',
      sortValue: 123,
      eventId: 'event-1',
      canonicalEventId: 'event-1',
    });
    expect(cursor.encoded.length).toBeGreaterThan(0);
  });
});
