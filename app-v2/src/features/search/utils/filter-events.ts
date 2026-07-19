import type { Event } from '@/features/events/types/event';
import {
  EVENT_REFERENCE_DATE,
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';

import {
  type DateRangeFilter,
  type EventFilters,
  type SortByFilter,
  buildEventSearchIndex,
  getSearchGenreLabel,
  type SearchGenreChipId,
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

export function matchesSearchGenre(event: Event, genreId: SearchGenreChipId): boolean {
  if (genreId === 'all') {
    return true;
  }

  const genreLabel = getSearchGenreLabel(genreId).toLowerCase();
  return event.genres.some((genre) => genre.toLowerCase() === genreLabel);
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
  if (dateRange === 'explore' || dateRange === 'all-dates') {
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
  if (!city || city === 'all') {
    return true;
  }

  return event.city.toLowerCase() === city.toLowerCase();
}

export function sortEvents(events: Event[], sortBy: SortByFilter): Event[] {
  const sorted = [...events];

  if (sortBy === 'name') {
    return sorted.sort((left, right) => left.title.localeCompare(right.title, 'de'));
  }

  if (sortBy === 'date') {
    return sorted.sort((left, right) => left.startDateTime.localeCompare(right.startDateTime));
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
      matchesSearchGenre(event, filters.genreId) &&
      matchesCity(event, filters.city) &&
      (options.preserveCollectionScope || matchesDateRange(event, filters.dateRange)),
  );

  return sortEvents(filtered, filters.sortBy);
}

/** @deprecated Use applyEventFilters with EventFilters */
export function filterSearchEvents(
  events: Event[],
  query: string,
  genreId: SearchGenreChipId,
  dateRange: DateRangeFilter,
): Event[] {
  return applyEventFilters(events, {
    query,
    genreId,
    city: 'Köln',
    sortBy: 'recommended',
    dateRange,
  });
}

/** @deprecated Use applyEventFilters with EventFilters */
export function filterExploreEvents(
  events: Event[],
  genreId: SearchGenreChipId,
  dateRange: DateRangeFilter,
): Event[] {
  return applyEventFilters(events, {
    query: '',
    genreId,
    city: 'Köln',
    sortBy: 'recommended',
    dateRange,
  });
}

export function countActiveFilters(filters: EventFilters): number {
  let count = 0;

  if (filters.query.trim().length > 0) count += 1;
  if (filters.genreId !== 'all') count += 1;
  if (filters.dateRange !== 'explore' && filters.dateRange !== 'all-dates') count += 1;
  if (filters.city !== 'Köln') count += 1;
  if (filters.sortBy !== 'recommended') count += 1;

  return count;
}

export function summarizeActiveFilters(filters: EventFilters): string {
  const parts: string[] = [];

  if (filters.dateRange === 'today') parts.push('Today');
  if (filters.dateRange === 'this-weekend') parts.push('This Weekend');
  if (filters.dateRange === 'upcoming') parts.push('Upcoming');
  if (filters.genreId !== 'all') parts.push(getSearchGenreLabel(filters.genreId));
  if (filters.city !== 'Köln') parts.push(filters.city);
  if (filters.sortBy === 'name') parts.push('A–Z');
  if (filters.sortBy === 'date') parts.push('Date');

  return parts.join(' · ');
}
