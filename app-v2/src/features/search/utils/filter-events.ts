import type { Event } from '@/features/events/types/event';
import {
  EVENT_REFERENCE_DATE,
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';
import {
  getDateLabel,
  getGenreLabel,
  getSortLabel,
  getActiveDistanceOptions,
  getActiveFestivalOptions,
  getActiveOrganizerOptions,
  getActivePriceOptions,
  getActiveVenueEnvironmentOptions,
  getActiveVenueOptions,
} from '@/features/search/config/filter-config';

import {
  DEFAULT_EVENT_FILTERS,
  type EventFilters,
  type SortByFilter,
  buildEventSearchIndex,
  type DateRangeFilter,
  type GenreFilterId,
} from '../constants';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function getQueryTerms(query: string): string[] {
  return normalizeQuery(query).split(/\s+/).filter(Boolean);
}

export function matchesSearchQuery(event: Event, query: string): boolean {
  const terms = getQueryTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = buildEventSearchIndex(event);
  return terms.every((term) => haystack.includes(term));
}

export function matchesSearchGenres(event: Event, genres: GenreFilterId[]): boolean {
  if (genres.length === 0) {
    return true;
  }

  const selectedLabels = genres.map((genreId) => getGenreLabel(genreId).toLowerCase());
  return event.genres.some((genre) => selectedLabels.includes(genre.toLowerCase()));
}

/** @deprecated Use matchesSearchGenres */
export function matchesSearchGenre(event: Event, genreId: string): boolean {
  if (genreId === 'all') {
    return true;
  }
  return matchesSearchGenres(event, [genreId as GenreFilterId]);
}

function isSameDay(isoDateTime: string, referenceDate: Date): boolean {
  const eventDate = new Date(isoDateTime);
  return (
    eventDate.getFullYear() === referenceDate.getFullYear() &&
    eventDate.getMonth() === referenceDate.getMonth() &&
    eventDate.getDate() === referenceDate.getDate()
  );
}

export function matchesDateRange(
  event: Event,
  dateRange: DateRangeFilter,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  if (dateRange === 'all-dates') {
    return true;
  }

  if (dateRange === 'today') {
    return isSameDay(event.startDateTime, referenceDate);
  }

  if (dateRange === 'this-weekend') {
    return isThisWeekEvent(event, referenceDate);
  }

  return isUpcomingEvent(event, referenceDate);
}

export function matchesCity(event: Event, city: string): boolean {
  if (!city) {
    return true;
  }

  return event.city.toLowerCase() === city.toLowerCase();
}

export function sortEvents(events: Event[], sortBy: SortByFilter): Event[] {
  const sorted = [...events];

  if (sortBy === 'alphabetical') {
    return sorted.sort((left, right) => left.title.localeCompare(right.title, 'de'));
  }

  return sorted.sort((left, right) => left.startDateTime.localeCompare(right.startDateTime));
}

export interface ApplyEventFiltersOptions {
  preserveCollectionScope?: boolean;
}

export function applyEventFilters(
  events: Event[],
  filters: EventFilters,
  options: ApplyEventFiltersOptions = {},
): Event[] {
  const filtered = events.filter(
    (event) =>
      matchesSearchQuery(event, filters.query) &&
      matchesSearchGenres(event, filters.genres) &&
      matchesCity(event, filters.city) &&
      (options.preserveCollectionScope || matchesDateRange(event, filters.dateRange)),
  );

  return sortEvents(filtered, filters.sortBy);
}

export function hasDiscoverySearchQuery(filters: EventFilters): boolean {
  return filters.query.trim().length > 0;
}

export function hasActiveFilters(filters: EventFilters): boolean {
  return countActiveFilters(filters) > 0 || hasDiscoverySearchQuery(filters);
}

export function isExploreMode(filters: EventFilters): boolean {
  return filters.query.trim().length === 0;
}

export function countActiveFilters(filters: EventFilters): number {
  let count = 0;

  if (filters.dateRange !== DEFAULT_EVENT_FILTERS.dateRange) count += 1;
  if (filters.genres.length > 0) count += 1;
  if (filters.city !== DEFAULT_EVENT_FILTERS.city) count += 1;
  if (filters.sortBy !== DEFAULT_EVENT_FILTERS.sortBy) count += 1;
  if (filters.distance !== DEFAULT_EVENT_FILTERS.distance) count += 1;
  if (filters.price !== DEFAULT_EVENT_FILTERS.price) count += 1;
  if (filters.venueEnvironment !== DEFAULT_EVENT_FILTERS.venueEnvironment) count += 1;
  if (filters.venueId) count += 1;
  if (filters.organizerId) count += 1;
  if (filters.festivalId) count += 1;
  if (filters.dateStartAt || filters.dateEndAt) count += 1;

  return count;
}

export function getActiveFilterSummaries(filters: EventFilters): string[] {
  const parts: string[] = [];

  if (filters.dateRange !== DEFAULT_EVENT_FILTERS.dateRange) {
    parts.push(getDateLabel(filters.dateRange));
  }

  if (filters.genres.length === 1) {
    parts.push(getGenreLabel(filters.genres[0]!));
  } else if (filters.genres.length > 1) {
    parts.push(`${filters.genres.length} Genres`);
  }

  if (filters.city !== DEFAULT_EVENT_FILTERS.city) {
    parts.push(filters.city);
  }

  if (filters.sortBy !== DEFAULT_EVENT_FILTERS.sortBy) {
    parts.push(getSortLabel(filters.sortBy));
  }

  if (filters.distance !== DEFAULT_EVENT_FILTERS.distance) {
    const distance = getActiveDistanceOptions().find((option) => option.id === filters.distance);
    if (distance) {
      parts.push(distance.label);
    }
  }

  if (filters.price !== DEFAULT_EVENT_FILTERS.price) {
    const price = getActivePriceOptions().find((option) => option.id === filters.price);
    if (price) {
      parts.push(price.label);
    }
  }

  if (filters.venueEnvironment !== DEFAULT_EVENT_FILTERS.venueEnvironment) {
    const environment = getActiveVenueEnvironmentOptions().find(
      (option) => option.id === filters.venueEnvironment,
    );
    if (environment) {
      parts.push(environment.label);
    }
  }

  if (filters.venueId) {
    const venue = getActiveVenueOptions().find((option) => option.id === filters.venueId);
    if (venue) {
      parts.push(venue.label);
    }
  }

  if (filters.organizerId) {
    const organizer = getActiveOrganizerOptions().find((option) => option.id === filters.organizerId);
    if (organizer) {
      parts.push(organizer.label);
    }
  }

  if (filters.festivalId) {
    const festival = getActiveFestivalOptions().find((option) => option.id === filters.festivalId);
    if (festival) {
      parts.push(festival.label);
    }
  }

  if (filters.dateStartAt || filters.dateEndAt) {
    parts.push('Zeitraum');
  }

  return parts;
}

export function summarizeActiveFilters(filters: EventFilters): string {
  return getActiveFilterSummaries(filters).join(' · ');
}
