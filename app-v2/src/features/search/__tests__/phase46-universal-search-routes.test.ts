import { describe, expect, it } from 'vitest';

import type { Event } from '@/features/events/types/event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import {
  buildUniversalSearchResults,
  scoreTextMatch,
} from '@/features/search/services/universal-search-service';

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'WESTBAM - SAVE THE RAVE 2027',
    description: 'Techno night at Bootshaus',
    startDateTime: '2026-08-01T20:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Bootshaus',
    venueId: 'venue-bootshaus',
    city: 'Köln',
    country: 'Germany',
    genres: ['Techno'],
    artists: ['WESTBAM'],
    organizer: 'Lehmann Club',
    organizerId: 'org-lehmann',
    source: 'ticket.io',
    sourceEventId: 'tio-1',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function display(source: Event): EventDisplayModel {
  return {
    id: source.id,
    title: source.title,
    venue: source.venue,
    city: source.city,
    date: '01.08.2026',
    startTime: '22:00',
    genres: source.genres,
    source: source.source,
  } as EventDisplayModel;
}

describe('Phase 4.6 universal search routes and ranking', () => {
  it('uses singular entity profile routes for named entities', async () => {
    const source = event();
    const grouped = await buildUniversalSearchResults({
      query: 'Bootshaus',
      filters: DEFAULT_EVENT_FILTERS,
      events: [display(source)],
      sourceEvents: [source],
      totalEventMatches: 1,
      hasMoreEvents: false,
      entityReaders: {
        listPublishedArtists: async () => [
          { id: 'artist-westbam', name: 'WESTBAM', slug: 'westbam', city: 'Berlin' },
        ],
        listVenues: async () => [
          { id: 'venue-bootshaus', name: 'Bootshaus', slug: 'bootshaus', city: 'Köln' },
          { id: 'venue-affenkaefig', name: 'Affenkäfig', slug: 'affenkaefig', city: 'Köln' },
        ],
        listOrganizers: async () => [
          { id: 'org-lehmann', name: 'Lehmann Club', slug: 'lehmann-club', city: 'Stuttgart' },
        ],
      },
    });

    expect(grouped.venues[0]?.route).toBe('/venue/bootshaus');
    expect(grouped.venues[0]?.route).not.toContain('/venues/');

    const westbam = await buildUniversalSearchResults({
      query: 'WESTBAM',
      filters: DEFAULT_EVENT_FILTERS,
      events: [display(source)],
      sourceEvents: [source],
      totalEventMatches: 1,
      hasMoreEvents: false,
      entityReaders: {
        listPublishedArtists: async () => [
          { id: 'artist-westbam', name: 'WESTBAM', slug: 'westbam', city: 'Berlin' },
        ],
        listVenues: async () => [],
        listOrganizers: async () => [],
      },
    });
    expect(westbam.artists[0]?.route).toBe('/artist/westbam');

    const lehmann = await buildUniversalSearchResults({
      query: 'Lehmann',
      filters: DEFAULT_EVENT_FILTERS,
      events: [display(source)],
      sourceEvents: [source],
      totalEventMatches: 1,
      hasMoreEvents: false,
      entityReaders: {
        listPublishedArtists: async () => [],
        listVenues: async () => [],
        listOrganizers: async () => [
          { id: 'org-lehmann', name: 'Lehmann Club', slug: 'lehmann-club', city: 'Stuttgart' },
        ],
      },
    });
    expect(lehmann.organizers[0]?.route).toBe('/organizer/lehmann-club');
  });

  it('prefers exact and prefix matches and gates short queries', () => {
    expect(scoreTextMatch('WESTBAM', 'WESTBAM')).toBeGreaterThan(
      scoreTextMatch('WESTBAM', 'WESTBAM Tribute Night'),
    );
    expect(scoreTextMatch('Boot', 'Bootshaus')).toBeGreaterThan(0);
    expect(scoreTextMatch('St', 'Stuttgart')).toBeGreaterThan(0);
    expect(scoreTextMatch('xy', 'Bootshaus')).toBe(0);
  });

  it('filters internal staging/demo entities from entity results', async () => {
    const source = event({ id: 'staging-seed-event', source: 'staging-seed' });
    const grouped = await buildUniversalSearchResults({
      query: 'Demo',
      filters: DEFAULT_EVENT_FILTERS,
      events: [display(source)],
      sourceEvents: [source],
      totalEventMatches: 1,
      hasMoreEvents: false,
      entityReaders: {
        listPublishedArtists: async () => [
          { id: 'demo-artist-1', name: 'Demo Artist', slug: 'demo-artist', city: 'Berlin' },
          { id: 'artist-real', name: 'Demo Real', slug: 'demo-real', city: 'Berlin' },
        ],
        listVenues: async () => [],
        listOrganizers: async () => [],
      },
    });

    expect(grouped.artists.every((artist) => !artist.id.startsWith('demo-'))).toBe(true);
  });

  it('matches Affenkäfig and Stuttgart city results with stable routes', async () => {
    const source = event({ city: 'Stuttgart', venue: 'Affenkäfig', venueId: 'venue-affen' });
    const grouped = await buildUniversalSearchResults({
      query: 'Affenkäfig',
      filters: DEFAULT_EVENT_FILTERS,
      events: [display(source)],
      sourceEvents: [source],
      totalEventMatches: 1,
      hasMoreEvents: false,
      entityReaders: {
        listPublishedArtists: async () => [],
        listVenues: async () => [
          { id: 'venue-affen', name: 'Affenkäfig', slug: 'affenkaefig', city: 'Köln' },
        ],
        listOrganizers: async () => [],
      },
    });

    expect(grouped.venues[0]?.title).toBe('Affenkäfig');
    expect(grouped.venues[0]?.route).toBe('/venue/affenkaefig');

    const stuttgart = await buildUniversalSearchResults({
      query: 'Stuttgart',
      filters: DEFAULT_EVENT_FILTERS,
      events: [display(source)],
      sourceEvents: [source],
      totalEventMatches: 1,
      hasMoreEvents: false,
      entityReaders: {
        listPublishedArtists: async () => [],
        listVenues: async () => [],
        listOrganizers: async () => [],
      },
    });

    expect(stuttgart.cities.some((city) => city.title === 'Stuttgart')).toBe(true);
    expect(stuttgart.cities.find((city) => city.title === 'Stuttgart')?.route).toContain(
      'Stuttgart',
    );
  });
});
