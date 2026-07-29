import {
  getDefaultCityValue,
  getGenreLabel,
  getDateLabel,
  getSortLabel,
} from '@/features/search/config/filter-config';
import type {
  DateRangeFilterId,
  DistanceFilterId,
  GenreFilterId,
  PriceFilterId,
  SortByFilterId,
  VenueEnvironmentFilterId,
} from '@/features/search/config/filter-config.types';

export type DateRangeFilter = DateRangeFilterId;
export type SortByFilter = SortByFilterId;
export type DistanceFilter = DistanceFilterId;
export type PriceFilter = PriceFilterId;
export type VenueEnvironmentFilter = VenueEnvironmentFilterId;
export type { GenreFilterId };
/** @deprecated Use GenreFilterId */
export type SearchGenreChipId = GenreFilterId | 'all';

export interface EventFilters {
  query: string;
  dateRange: DateRangeFilter;
  genres: GenreFilterId[];
  city: string;
  sortBy: SortByFilter;
  distance: DistanceFilter;
  price: PriceFilter;
  venueEnvironment: VenueEnvironmentFilter;
  venueId: string | null;
  organizerId: string | null;
  festivalId: string | null;
  dateStartAt: string | null;
  dateEndAt: string | null;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  query: '',
  dateRange: 'all-dates',
  genres: [],
  city: getDefaultCityValue(),
  sortBy: 'recommended',
  distance: 'any',
  price: 'any',
  venueEnvironment: 'any',
  venueId: null,
  organizerId: null,
  festivalId: null,
  dateStartAt: null,
  dateEndAt: null,
};

export { EVENT_REFERENCE_DATE as SEARCH_DEMO_REFERENCE_DATE } from '@/features/events/formatting/date-time';
export { filterConfig } from '@/features/search/config/filter-config';
export type { FilterConfig } from '@/features/search/config/filter-config.types';

export function buildEventSearchIndex(event: {
  title: string;
  venue: string;
  city: string;
  genres: string[];
  artists: string[];
  organizer?: string;
}): string {
  return [event.title, event.venue, event.city, event.organizer, ...event.genres, ...event.artists]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();
}

/** @deprecated Use getGenreLabel from filter-config */
export function getSearchGenreLabel(genreId: string): string {
  if (genreId === 'all') {
    return '';
  }
  return getGenreLabel(genreId);
}

export { getGenreLabel, getDateLabel, getSortLabel };
