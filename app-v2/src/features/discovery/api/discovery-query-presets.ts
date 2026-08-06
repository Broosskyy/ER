import type { DiscoveryQuery } from '../domain/discovery-query-types';
import { DEFAULT_DISCOVERY_PAGE_SIZE } from '../domain/discovery-pagination-types';

export interface DiscoveryQueryPresetOptions {
  limit?: number;
  cursor?: DiscoveryQuery['cursor'];
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  genres?: string[];
}

export function buildTodayQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'home_today',
    date: { preset: 'today' },
    sortBy: 'date',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildWeekendQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'events_explore',
    date: { preset: 'this-weekend' },
    sortBy: 'date',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildThisWeekQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'events_list',
    date: { preset: 'this-week' },
    sortBy: 'date',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildNextWeekQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'events_list',
    date: { preset: 'next-week' },
    sortBy: 'date',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildNearbyQuery(options: DiscoveryQueryPresetOptions): DiscoveryQuery {
  return {
    surface: 'home_nearby',
    location: {
      latitude: options.latitude,
      longitude: options.longitude,
      radiusKm: options.radiusKm ?? 50,
      city: options.city,
    },
    sortBy: 'distance',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.genres?.length ? { genres: options.genres } : undefined,
  };
}

export function buildTrendingQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'home_featured',
    date: { preset: 'upcoming' },
    sortBy: 'relevance',
    diversify: true,
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildSearchQuery(
  text: string,
  options: DiscoveryQueryPresetOptions & { locale?: 'de' | 'en' } = {},
): DiscoveryQuery {
  return {
    surface: 'search_events',
    search: { text, mode: 'fuzzy', locale: options.locale ?? 'de' },
    sortBy: 'relevance',
    diversify: true,
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city, genres: options.genres } : undefined,
  };
}

export function buildUpcomingHighlightsQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'home_featured',
    date: { preset: 'upcoming' },
    sortBy: 'relevance',
    diversify: true,
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildNewlyAddedQuery(options: DiscoveryQueryPresetOptions = {}): DiscoveryQuery {
  return {
    surface: 'events_list',
    date: { preset: 'upcoming' },
    sortBy: 'newest',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
    entities: options.city ? { city: options.city } : undefined,
  };
}

export function buildGenreQuery(
  genre: string,
  options: DiscoveryQueryPresetOptions = {},
): DiscoveryQuery {
  return {
    surface: 'events_explore',
    date: { preset: 'upcoming' },
    sortBy: 'date',
    entities: {
      city: options.city,
      genres: [genre],
    },
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
  };
}

export function buildEntityEventsQuery(
  surface: DiscoveryQuery['surface'],
  entities: DiscoveryQuery['entities'],
  options: DiscoveryQueryPresetOptions = {},
): DiscoveryQuery {
  return {
    surface,
    entities,
    sortBy: 'date',
    limit: options.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE,
    cursor: options.cursor,
  };
}

export function buildSimilarEventsQuery(
  event: {
    genres: string[];
    city?: string;
    venueId?: string;
    organizerId?: string;
    festivalId?: string;
    artistIds?: string[];
  },
  options: DiscoveryQueryPresetOptions = {},
): DiscoveryQuery {
  return {
    surface: 'similar_events',
    date: { preset: 'upcoming' },
    sortBy: 'relevance',
    diversify: true,
    limit: options.limit ?? 6,
    cursor: options.cursor,
    entities: {
      genres: event.genres.length > 0 ? [...event.genres] : undefined,
      city: event.city ?? options.city,
    },
    similarTo: {
      venueId: event.venueId,
      organizerId: event.organizerId,
      festivalId: event.festivalId,
      artistIds: event.artistIds?.length ? [...event.artistIds] : undefined,
    },
  };
}
