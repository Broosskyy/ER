import type { DiscoveryCursor } from './discovery-pagination-types';
import type { DiscoverySearchQuery } from './discovery-search-types';

export const DISCOVERY_DATE_PRESETS = [
  'all',
  'today',
  'tomorrow',
  'this-weekend',
  'this-week',
  'next-week',
  'next-month',
  'upcoming',
  'custom',
] as const;

export type DiscoveryDatePreset = (typeof DISCOVERY_DATE_PRESETS)[number];

export const DISCOVERY_SORT_FIELDS = [
  'relevance',
  'distance',
  'date',
  'newest',
  'popularity',
  'freshness',
  'alphabetical',
] as const;

export type DiscoverySortField = (typeof DISCOVERY_SORT_FIELDS)[number];

export const DISCOVERY_SURFACES = [
  'home_featured',
  'home_today',
  'home_nearby',
  'events_explore',
  'events_list',
  'search_events',
  'similar_events',
  'map',
  'organizer_events',
  'venue_events',
  'festival_events',
] as const;

export type DiscoverySurface = (typeof DISCOVERY_SURFACES)[number];

export interface DiscoveryLocationContext {
  latitude?: number;
  longitude?: number;
  city?: string;
  radiusKm?: number;
}

export interface DiscoveryDateFilter {
  preset?: DiscoveryDatePreset;
  startAt?: string;
  endAt?: string;
  includePast?: boolean;
}

export interface DiscoveryEntityFilter {
  venueId?: string;
  organizerId?: string;
  festivalEditionId?: string;
  festivalId?: string;
  city?: string;
  genreIds?: string[];
  genres?: string[];
}

export interface DiscoveryPriceFilter {
  freeOnly?: boolean;
  maxPriceEur?: number;
}

export interface DiscoveryVenueEnvironmentFilter {
  indoor?: boolean;
  outdoor?: boolean;
}

export interface DiscoveryQuery {
  surface: DiscoverySurface;
  search?: DiscoverySearchQuery;
  date?: DiscoveryDateFilter;
  entities?: DiscoveryEntityFilter;
  location?: DiscoveryLocationContext;
  price?: DiscoveryPriceFilter;
  venueEnvironment?: DiscoveryVenueEnvironmentFilter;
  sortBy?: DiscoverySortField;
  sortDirection?: 'asc' | 'desc';
  cursor?: DiscoveryCursor;
  limit?: number;
  diversify?: boolean;
}

export interface DiscoveryResultItem<TEvent = unknown> {
  event: TEvent;
  score?: number;
  distanceKm?: number;
  rank?: number;
}

export interface DiscoveryQueryResult<TEvent = unknown> {
  items: DiscoveryResultItem<TEvent>[];
  nextCursor?: DiscoveryCursor;
  hasMore: boolean;
  totalMatched: number;
}
