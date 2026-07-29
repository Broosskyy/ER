import { describe, expect, it } from 'vitest';

import { EventRepository } from '@/data/repositories/repositories';
import { buildEventSearchIndex } from '@/features/search/constants';
import { matchesSearchQuery } from '@/features/search/utils/filter-events';
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
    city: 'Köln',
    country: 'Germany',
    genres: ['Techno'],
    artists: ['DJ Alias'],
    organizer: 'Boiler Room',
    source: 'demo',
    sourceEventId: 'event-1',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('search relationship index', () => {
  it('finds events by venue', () => {
    expect(matchesSearchQuery(event(), 'bootshaus')).toBe(true);
  });

  it('finds events by organizer', () => {
    expect(matchesSearchQuery(event(), 'boiler')).toBe(true);
    expect(buildEventSearchIndex(event())).toContain('boiler room');
  });

  it('finds events by artist', () => {
    expect(matchesSearchQuery(event(), 'alias')).toBe(true);
  });

  it('keeps saved canonical references addressable after merge alias', () => {
    const repository = new EventRepository();
    repository.applyCanonicalAliases(new Map([['legacy-1', 'event-1']]));
    repository.initializeSync([event({ id: 'event-1' })]);

    expect(repository.getEventById('legacy-1')?.id).toBe('event-1');
    expect(repository.resolveCanonicalId('legacy-1')).toBe('event-1');
  });
});
