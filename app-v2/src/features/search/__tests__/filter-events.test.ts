import { describe, expect, it } from 'vitest';

import type { Event } from '@/features/events/types/event';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import {
  applyEventFilters,
  countActiveFilters,
  getActiveFilterSummaries,
  isExploreMode,
  matchesSearchGenres,
  matchesSearchQuery,
} from '@/features/search/utils/filter-events';

const sampleEvents: Event[] = [
  {
    id: 'event-1',
    slug: 'event-1',
    title: 'VOID: Techno Saturday',
    description: 'Demo',
    startDateTime: '2026-05-24T20:00:00.000Z',
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

  it('combines multi-genre and date range filters', () => {
    const results = applyEventFilters(sampleEvents, {
      ...DEFAULT_EVENT_FILTERS,
      genres: ['techno'],
      dateRange: 'today',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('event-1');
  });

  it('matches any selected genre in multi-select', () => {
    const results = applyEventFilters(sampleEvents, {
      ...DEFAULT_EVENT_FILTERS,
      genres: ['house', 'techno'],
    });

    expect(results).toHaveLength(2);
  });

  it('sorts events alphabetically', () => {
    const results = applyEventFilters(sampleEvents, {
      ...DEFAULT_EVENT_FILTERS,
      sortBy: 'alphabetical',
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

describe('matchesSearchGenres', () => {
  it('returns all events when no genres selected', () => {
    expect(matchesSearchGenres(sampleEvents[0]!, [])).toBe(true);
  });

  it('matches exact genre labels', () => {
    expect(matchesSearchGenres(sampleEvents[0]!, ['techno'])).toBe(true);
    expect(matchesSearchGenres(sampleEvents[1]!, ['techno'])).toBe(false);
  });
});

describe('countActiveFilters', () => {
  it('counts active non-default filters only', () => {
    expect(countActiveFilters(DEFAULT_EVENT_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...DEFAULT_EVENT_FILTERS,
        dateRange: 'this-weekend',
        genres: ['techno', 'house'],
        sortBy: 'alphabetical',
      }),
    ).toBe(3);
  });

  it('does not count default city Köln', () => {
    expect(countActiveFilters(DEFAULT_EVENT_FILTERS)).toBe(0);
  });
});

describe('getActiveFilterSummaries', () => {
  it('summarizes single and multiple genres', () => {
    expect(
      getActiveFilterSummaries({
        ...DEFAULT_EVENT_FILTERS,
        dateRange: 'today',
        genres: ['techno'],
        sortBy: 'alphabetical',
      }),
    ).toEqual(['Heute', 'Techno', 'Alphabetisch']);

    expect(
      getActiveFilterSummaries({
        ...DEFAULT_EVENT_FILTERS,
        genres: ['techno', 'house', 'trance'],
      }),
    ).toEqual(['3 Genres']);
  });
});

describe('isExploreMode', () => {
  it('is true without a search query and false when searching', () => {
    expect(isExploreMode(DEFAULT_EVENT_FILTERS)).toBe(true);
    expect(isExploreMode({ ...DEFAULT_EVENT_FILTERS, query: 'techno' })).toBe(false);
    expect(isExploreMode({ ...DEFAULT_EVENT_FILTERS, genres: ['techno'] })).toBe(true);
  });
});
