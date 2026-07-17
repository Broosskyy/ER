import {
  EVENT_REFERENCE_DATE,
  isThisWeekEvent,
  isUpcomingEvent,
  type Event,
} from '@/features/events';

export const EXPLORE_TIME_FILTERS = [
  { id: 'explore', label: 'Explore' },
  { id: 'today', label: 'Today' },
  { id: 'this-weekend', label: 'This Weekend' },
  { id: 'upcoming', label: 'Upcoming' },
] as const;

export type ExploreTimeFilterId = (typeof EXPLORE_TIME_FILTERS)[number]['id'];

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

export { EVENT_REFERENCE_DATE as SEARCH_DEMO_REFERENCE_DATE } from '@/features/events';

export const DEFAULT_EXPLORE_TIME_FILTER: ExploreTimeFilterId = 'explore';
export const DEFAULT_SEARCH_GENRE: SearchGenreChipId = 'all';

export interface SearchFiltersState {
  query: string;
  timeFilter: ExploreTimeFilterId;
  genreId: SearchGenreChipId;
}

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  query: '',
  timeFilter: DEFAULT_EXPLORE_TIME_FILTER,
  genreId: DEFAULT_SEARCH_GENRE,
};

export function getSearchGenreLabel(genreId: SearchGenreChipId): string {
  return SEARCH_GENRE_CHIPS.find((chip) => chip.id === genreId)?.label ?? '';
}

export function buildEventSearchIndex(event: Event): string {
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
  timeFilter: ExploreTimeFilterId,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  if (timeFilter === 'explore') {
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
