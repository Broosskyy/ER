import {
  artistRepository,
  organizerRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { getDiscoveryEngine } from '@/features/discovery/discovery-runtime';
import { mapEventFiltersToDiscoveryQuery } from '@/features/discovery/utils/map-event-filters-to-discovery-query';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventFilters } from '@/features/search/constants';

import type { DiscoverySearchLocationContext } from '../feed/search-feed-types';
import { loadDiscoverySearchResults } from '../feed/discovery-search-client';
import type { UniversalSearchGroupedResults } from '../domain/universal-search-types';
import { buildUniversalSearchResults } from '../services/universal-search-service';

const entityReaders = {
  async listPublishedArtists() {
    const artists = await artistRepository.getPublished();
    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
      imageUrl: artist.imageUrl,
      city: artist.city,
    }));
  },
  async listVenues() {
    const venues = await venueRepository.getAll();
    return venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      city: venue.city,
      venueType: venue.venueType,
    }));
  },
  async listOrganizers() {
    const organizers = await organizerRepository.getAll();
    return organizers.map((organizer) => ({
      id: organizer.id,
      name: organizer.name,
      slug: organizer.slug,
      city: organizer.city,
      logoUrl: organizer.logoUrl,
    }));
  },
};

export async function loadUniversalSearchResults(
  filters: EventFilters,
  options: {
    location?: DiscoverySearchLocationContext;
    limit?: number;
  } = {},
): Promise<UniversalSearchGroupedResults> {
  const eventResult = await loadDiscoverySearchResults(filters, options);
  const query = mapEventFiltersToDiscoveryQuery(filters, {
    surface: 'search_events',
    latitude: options.location?.latitude,
    longitude: options.location?.longitude,
  });
  const sourceResult = await getDiscoveryEngine().query(query);

  return buildUniversalSearchResults({
    query: filters.query,
    filters,
    events: eventResult.events,
    sourceEvents: sourceResult.items.map((item) => item.event),
    totalEventMatches: eventResult.totalMatched,
    hasMoreEvents: eventResult.hasMore,
    entityReaders,
  });
}

export function filterGroupedResultsByTab(
  results: UniversalSearchGroupedResults,
  tab: EventFilters['entityTab'],
): {
  events: EventDisplayModel[];
  artists: UniversalSearchGroupedResults['artists'];
  venues: UniversalSearchGroupedResults['venues'];
  organizers: UniversalSearchGroupedResults['organizers'];
} {
  if (tab === 'events') {
    return {
      events: results.events,
      artists: [],
      venues: [],
      organizers: [],
    };
  }

  if (tab === 'artists') {
    return { events: [], artists: results.artists, venues: [], organizers: [] };
  }

  if (tab === 'venues') {
    return { events: [], artists: [], venues: results.venues, organizers: [] };
  }

  if (tab === 'organizers') {
    return { events: [], artists: [], venues: [], organizers: results.organizers };
  }

  return {
    events: results.events,
    artists: results.artists,
    venues: results.venues,
    organizers: results.organizers,
  };
}
