import { describe, expect, it, beforeEach, vi } from 'vitest';

import { eventRepository } from '@/data/repositories/registry';
import { FixedClock } from '@/core/clock/fixed-clock';
import type { Event } from '@/features/events/types/event';

vi.mock('@/features/events/formatting/display-event', () => ({
  toEventDisplayModel: (event: Event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    image: 0,
    date: '01 AUG',
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
  }),
}));

import { getDiscoveryFeedEvents, getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-service';

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-upcoming',
    slug: 'event-upcoming',
    title: 'Upcoming Event',
    description: 'Description',
    startDateTime: '2026-08-01T20:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Bootshaus',
    city: 'Köln',
    country: 'Germany',
    latitude: 50.9,
    longitude: 6.9,
    genres: ['Techno'],
    artists: ['DJ'],
    organizer: 'Boiler Room',
    imageUrl: 'https://example.com/image.jpg',
    source: 'import',
    sourceEventId: 'event-upcoming',
    status: 'published',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('discovery feed service', () => {
  beforeEach(() => {
    eventRepository.resetForTesting();
  });

  it('excludes ended events from discoverable pool', () => {
    eventRepository.initializeSync([
      event(),
      event({
        id: 'event-ended',
        slug: 'event-ended',
        title: 'Ended Event',
        startDateTime: '2026-07-01T20:00:00.000Z',
        endDateTime: '2026-07-01T23:00:00.000Z',
      }),
    ]);

    const clock = new FixedClock(new Date('2026-07-15T12:00:00.000Z'));
    const discoverable = getDiscoverablePublishedEvents(clock);
    expect(discoverable.map((entry) => entry.id)).toEqual(['event-upcoming']);
  });

  it('deduplicates canonical aliases in ranked discovery feed', () => {
    eventRepository.applyCanonicalAliases(new Map([['legacy-1', 'event-upcoming']]));
    eventRepository.initializeSync([
      event({ id: 'legacy-1', slug: 'legacy-1' }),
      event({ id: 'event-upcoming' }),
    ]);

    const feed = getDiscoveryFeedEvents({
      surface: 'search_events',
      clock: new FixedClock(new Date('2026-07-15T12:00:00.000Z')),
    });

    expect(feed).toHaveLength(1);
    expect(feed[0]?.id).toBe('event-upcoming');
  });
});
