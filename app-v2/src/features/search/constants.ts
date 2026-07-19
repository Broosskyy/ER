import { appConfig } from '@/design/layout';
import { EVENT_REFERENCE_DATE } from '@/features/events/formatting/date-time';
import {
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';
import type { Event } from '@/features/events/types/event';

export const DATE_RANGE_FILTERS = [
  { id: 'explore', label: 'Explore' },
  { id: 'today', label: 'Today' },
  { id: 'this-weekend', label: 'This Weekend' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all-dates', label: 'All Dates' },
] as const;

export type DateRangeFilter = (typeof DATE_RANGE_FILTERS)[number]['id'];

export const SORT_BY_FILTERS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'date', label: 'Date' },
  { id: 'name', label: 'A–Z' },
] as const;

export type SortByFilter = (typeof SORT_BY_FILTERS)[number]['id'];

export const SEARCH_GENRE_CHIPS = [
  { id: 'all', label: 'All Genres' },
  { id: 'techno', label: 'Techno' },
  { id: 'hard-techno', label: 'Hard Techno' },
  { id: 'house', label: 'House' },
  { id: 'trance', label: 'Trance' },
  { id: 'psy', label: 'Psy' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'drum-and-bass', label: 'Drum & Bass' },
] as const;

export type SearchGenreChipId = (typeof SEARCH_GENRE_CHIPS)[number]['id'];

export { EVENT_REFERENCE_DATE as SEARCH_DEMO_REFERENCE_DATE } from '@/features/events/formatting/date-time';

export interface EventFilters {
  query: string;
  dateRange: DateRangeFilter;
  genreId: SearchGenreChipId;
  city: string;
  sortBy: SortByFilter;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  query: '',
  dateRange: 'explore',
  genreId: 'all',
  city: appConfig.defaultCity,
  sortBy: 'recommended',
};

export type ExploreTimeFilterId = DateRangeFilter;

export const EXPLORE_TIME_FILTERS = DATE_RANGE_FILTERS.filter((item) => item.id !== 'all-dates');

export const DEFAULT_EXPLORE_TIME_FILTER: DateRangeFilter = 'explore';
export const DEFAULT_SEARCH_GENRE: SearchGenreChipId = 'all';

export interface SearchFiltersState extends EventFilters {
  timeFilter: DateRangeFilter;
}

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  ...DEFAULT_EVENT_FILTERS,
  timeFilter: DEFAULT_EXPLORE_TIME_FILTER,
};

export function getSearchGenreLabel(genreId: SearchGenreChipId): string {
  return SEARCH_GENRE_CHIPS.find((chip) => chip.id === genreId)?.label ?? '';
}

export function buildEventSearchIndex(event: {
  title: string;
  venue: string;
  city: string;
  genres: string[];
  artists: string[];
}): string {
  return [event.title, event.venue, event.city, ...event.genres, ...event.artists]
    .join(' ')
    .toLowerCase();
}

function isSameDay(isoDateTime: string, referenceDate: Date): boolean {
  const eventDate = new Date(isoDateTime);
  return (
    eventDate.getFullYear() === referenceDate.getFullYear() &&
    eventDate.getMonth() === referenceDate.getMonth() &&
    eventDate.getDate() === referenceDate.getDate()
  );
}

export function matchesExploreTimeFilter(
  event: Event,
  timeFilter: DateRangeFilter,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  if (timeFilter === 'explore' || timeFilter === 'all-dates') {
    return true;
  }

  if (timeFilter === 'today') {
    return isSameDay(event.startDateTime, referenceDate);
  }

  if (timeFilter === 'this-weekend') {
    return isThisWeekEvent(event, referenceDate);
  }

  return isUpcomingEvent(event, referenceDate);
}
