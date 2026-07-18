import { describe, expect, it } from 'vitest';

import type { Event } from '@/features/events/types/event';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import {
  applyEventFilters,
  countActiveFilters,
  matchesSearchQuery,
} from '@/features/search/utils/filter-events';

const sampleEvents: Event[] = [
  {
    id: 'event-1',
    slug: 'event-1',
    title: 'VOID: Techno Saturday',
    description: 'Demo',
    startDateTime: '2026-05-24T23:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Bootshaus',
    city: 'Köln',
    country: 'Germany',
    genres: ['Techno', 'Hard Techno'],
    artists: ['VOID Collective'],
    source: 'demo',
    sourceEventId: 'event-1',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'event-2',
    slug: 'event-2',
    title: 'Rhein Nights',
    description: 'Demo',
    startDateTime: '2026-05-25T22:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Artheater',
    city: 'Köln',
    country: 'Germany',
    genres: ['House'],
    artists: ['Residents'],
    source: 'demo',
    sourceEventId: 'event-2',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('applyEventFilters', () => {
  it('filters by search query across title and venue', () => {
    const results = applyEventFilters(sampleEvents, {
      ...DEFAULT_EVENT_FILTERS,
      query: 'bootshaus',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.venue.toLowerCase()).toContain('bootshaus');
  });

  it('combines genre and date range filters', () => {
    const results = applyEventFilters(sampleEvents, {
      ...DEFAULT_EVENT_FILTERS,
      genreId: 'techno',
      dateRange: 'today',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('event-1');
  });

  it('sorts events alphabetically', () => {
    const results = applyEventFilters(sampleEvents, {
      ...DEFAULT_EVENT_FILTERS,
      sortBy: 'name',
    });

    const titles = results.map((event) => event.title);
    expect([...titles].sort((a, b) => a.localeCompare(b, 'de'))).toEqual(titles);
  });
});

describe('matchesSearchQuery', () => {
  it('matches partial terms case-insensitively', () => {
    const event = sampleEvents[0]!;
    expect(matchesSearchQuery(event, 'VOID')).toBe(true);
    expect(matchesSearchQuery(event, 'void techno')).toBe(true);
  });
});

describe('countActiveFilters', () => {
  it('counts active non-default filters', () => {
    expect(countActiveFilters(DEFAULT_EVENT_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...DEFAULT_EVENT_FILTERS,
        query: 'techno',
        dateRange: 'this-weekend',
      }),
    ).toBe(2);
  });
});
