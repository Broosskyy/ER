import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import type {
  ArtistRecord,
  CityRecord,
  GenreRecord,
  VenueRecord,
} from '@/data/types/records';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { KnownEventForDuplicateCheck } from '@/features/import/matching/match-result';
import { GENRE_SYNONYMS } from '@/features/import/matching/matching-config';
import { slugifyMatchText } from '@/features/import/matching/matching-utils';
import type { Event } from '@/features/events/types/event';

function mapGenreAliases(genre: GenreRecord): string[] {
  const slug = genre.slug ?? slugifyMatchText(genre.name);
  return (GENRE_SYNONYMS[slug] ?? []).map((value) => value);
}

export async function loadMatchingCatalog(): Promise<MatchingCatalog> {
  const bundle = getDatasourceBundle();
  const [cities, venues, organizers, artists, genres, publishedEvents] = await Promise.all([
    bundle.cities.getActive(),
    bundle.venues.getAll(),
    bundle.organizers.getAll(),
    bundle.artists.getPublished(),
    bundle.genres.getActive(),
    bundle.events.getPublishedEvents(),
  ]);

  const cityById = new Map(cities.map((city) => [city.id, city]));

  return {
    cities: cities.map((city) => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
    })),
    venues: venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      cityId: venue.cityId,
      cityName: cityById.get(venue.cityId)?.name,
      latitude: venue.latitude,
      longitude: venue.longitude,
    })),
    organizers: organizers.map((organizer) => ({
      id: organizer.id,
      name: organizer.name,
      city: organizer.city,
      country: organizer.country,
      website: organizer.website,
      email: organizer.email,
      instagram: organizer.instagram,
      facebook: organizer.facebook,
      soundcloud: organizer.soundcloud,
      residentAdvisor: organizer.residentAdvisor,
    })),
    artists: artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
    })),
    genres: genres.map((genre) => ({
      id: genre.id,
      name: genre.name,
      slug: genre.slug,
      aliases: mapGenreAliases(genre),
    })),
    events: publishedEvents.map(mapEventToDuplicateCandidate),
  };
}

function mapEventToDuplicateCandidate(event: Event): KnownEventForDuplicateCheck {
  return {
    id: event.id,
    title: event.title,
    startDate: event.startDateTime,
    externalId: event.sourceEventId,
    venueName: event.venue,
    cityName: event.city,
    latitude: event.latitude,
    longitude: event.longitude,
    artistNames: event.artists,
    eventUrl: event.sourceUrl,
    ticketUrl: event.ticketUrl,
  };
}

export function createTestMatchingCatalog(overrides: Partial<MatchingCatalog> = {}): MatchingCatalog {
  return {
    cities: overrides.cities ?? [
      { id: 'koeln', name: 'Köln', slug: 'koeln' },
      { id: 'muenchen', name: 'München', slug: 'muenchen' },
    ],
    venues: overrides.venues ?? [
      {
        id: 'venue-1',
        name: 'Bootshaus',
        address: 'Auenweg 173, 51063 Köln',
        cityId: 'koeln',
        cityName: 'Köln',
        latitude: 50.965,
        longitude: 7.005,
      },
    ],
    organizers: overrides.organizers ?? [
      {
        id: 'organizer-1',
        name: 'Rave Rebels',
        city: 'Köln',
        country: 'Germany',
        website: 'https://raverebels.example',
      },
    ],
    artists: overrides.artists ?? [
      { id: 'artist-1', name: 'Ben Klock' },
      { id: 'artist-2', name: 'Dax J' },
    ],
    genres: overrides.genres ?? [
      { id: 'techno', name: 'Techno', slug: 'techno', aliases: ['techno'] },
      { id: 'tech-house', name: 'Tech House', slug: 'tech-house', aliases: ['tech house', 'techhouse'] },
    ],
    events: overrides.events ?? [
      {
        id: 'event-1',
        title: 'Techno Night',
        startDate: '2026-08-15T20:00:00.000Z',
        externalId: 'ext-existing-1',
        venueName: 'Bootshaus',
        cityName: 'Köln',
        latitude: 50.965,
        longitude: 7.005,
        artistNames: ['Ben Klock'],
        eventUrl: 'https://example.com/events/techno-night',
      },
    ],
  };
}
