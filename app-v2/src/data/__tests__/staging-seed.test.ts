import { describe, expect, it } from 'vitest';

import { mapEventRowToDomain } from '@/data/mappers/event-mapper';
import { getCollectionConfig } from '@/features/collections/event-collection-config';
import { isFeaturedEventId } from '@/features/events/data/home-config';
import { getTonightEvents, getWeekendEvents } from '@/features/home/utils/home-sections';
import { applyEventFilters } from '@/features/search/utils/filter-events';
import { EventRepository } from '@/data/repositories/repositories';

function seedEvent(
  id: string,
  overrides: Partial<ReturnType<typeof mapEventRowToDomain>> = {},
) {
  return mapEventRowToDomain(
    {
      id,
      title: overrides.title ?? id,
      subtitle: null,
      description: overrides.description ?? 'staging seed test event',
      genre_id: 'staging-seed-genre-techno',
      venue_id: 'staging-seed-venue-bootshaus',
      organizer_id: null,
      organizer: null,
      city_id: 'staging-seed-city-koeln',
      artist_id: 'staging-seed-artist-daxson',
      source_id: 'staging-seed-source-manual',
      collection_id: null,
      start_date: overrides.startDateTime ?? '2026-05-24T22:00:00+02:00',
      end_date: null,
      ticket_url: overrides.ticketUrl ?? 'https://example.com/ticket',
      website_url: null,
      instagram_url: null,
      facebook_url: null,
      image_url: null,
      flyer_url: null,
      venue_name: null,
      venue_city: null,
      status: 'published',
      created_by: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      venueName: overrides.venue ?? 'Bootshaus',
      cityName: overrides.city ?? 'Köln',
      genreName: overrides.genres?.[0] ?? 'Techno',
      artists: overrides.artists ?? ['Daxson'],
      latitude: 50.9234,
      longitude: 6.9672,
    },
  );
}

describe('staging seed event mapping', () => {
  it('maps joined Supabase relations into domain event fields', () => {
    const event = mapEventRowToDomain(
      {
        id: 'staging-seed-event-tonight-house',
        title: 'Cologne House Flow',
        subtitle: 'Free Entry',
        description: 'Open-air house session.',
        genre_id: 'staging-seed-genre-house',
        venue_id: 'staging-seed-venue-odessa',
        organizer_id: null,
        organizer: null,
        city_id: 'staging-seed-city-koeln',
        artist_id: 'staging-seed-artist-peachlychee',
        source_id: 'staging-seed-source-manual',
        collection_id: null,
        start_date: '2026-05-24T20:00:00+02:00',
        end_date: '2026-05-25T02:00:00+02:00',
        ticket_url: null,
        website_url: null,
        instagram_url: null,
        facebook_url: null,
        image_url: null,
        flyer_url: null,
        venue_name: null,
        venue_city: null,
        status: 'published',
        created_by: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        venueName: 'Odessa',
        cityName: 'Köln',
        genreName: 'House',
        artists: ['Peachlychee'],
        latitude: 50.942,
        longitude: 6.9591,
        address: 'Hornstraße 85, 50825 Köln',
      },
    );

    expect(event.venue).toBe('Odessa');
    expect(event.city).toBe('Köln');
    expect(event.genres).toEqual(['House']);
    expect(event.artists).toEqual(['Peachlychee']);
    expect(event.latitude).toBe(50.942);
    expect(event.longitude).toBe(6.9591);
    expect(event.ticketUrl).toBeUndefined();
    expect(event.imageUrl).toBeUndefined();
  });

  it('supports home, filter, and collection flows for seed-shaped events', () => {
    const repository = new EventRepository();
    const events = [
      seedEvent('void-techno-saturday', { genres: ['Techno'], city: 'Köln' }),
      seedEvent('staging-seed-event-tonight-house', {
        title: 'Cologne House Flow',
        genres: ['House'],
        artists: ['Peachlychee'],
        venue: 'Odessa',
        startDateTime: '2026-05-24T20:00:00+02:00',
        ticketUrl: undefined,
      }),
      seedEvent('staging-seed-event-berlin-house', {
        title: 'Berlin House District',
        genres: ['House'],
        city: 'Berlin',
        venue: '://about blank',
        startDateTime: '2026-05-28T23:00:00+02:00',
      }),
      seedEvent('staging-seed-event-draft-secret', {
        startDateTime: '2026-05-24T22:00:00+02:00',
      }),
    ];

    repository.initializeSync(events.filter((event) => event.id !== 'staging-seed-event-draft-secret'));

    const published = repository.getPublishedEvents();
    expect(published).toHaveLength(3);
    expect(published.some((event) => event.id === 'staging-seed-event-draft-secret')).toBe(false);
    expect(getTonightEvents(published)).toHaveLength(1);
    expect(getWeekendEvents(published).some((event) => event.city === 'Berlin')).toBe(true);
    expect(
      getCollectionConfig('highlights')
        .selectEvents(published)
        .some((event) => isFeaturedEventId(event.id)),
    ).toBe(true);

    const searchResults = applyEventFilters(published, {
      query: 'Peachlychee',
      genres: [],
      city: '',
      dateRange: 'all-dates',
      sortBy: 'recommended',
    });
    expect(searchResults).toHaveLength(1);

    const berlinResults = applyEventFilters(published, {
      query: '',
      genres: [],
      city: 'Berlin',
      dateRange: 'all-dates',
      sortBy: 'recommended',
    });
    expect(berlinResults).toHaveLength(1);
  });
});
