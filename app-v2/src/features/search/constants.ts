import type { Event } from '@/features/events';

export const SEARCH_GENRE_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'techno', label: 'Techno' },
  { id: 'hard-techno', label: 'Hard Techno' },
  { id: 'house', label: 'House' },
  { id: 'trance', label: 'Trance' },
  { id: 'psy', label: 'Psy' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'drum-and-bass', label: 'Drum & Bass' },
] as const;

export type SearchGenreChipId = (typeof SEARCH_GENRE_CHIPS)[number]['id'];

export const SEARCH_SORT_OPTIONS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'this-week', label: 'This Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'all', label: 'All' },
] as const;

export type SearchSortOption = (typeof SEARCH_SORT_OPTIONS)[number]['id'];

export { EVENT_REFERENCE_DATE as SEARCH_DEMO_REFERENCE_DATE } from '@/features/events';

export const DEFAULT_SEARCH_GENRE: SearchGenreChipId = 'all';
export const DEFAULT_SEARCH_SORT: SearchSortOption = 'upcoming';

export interface SearchFiltersState {
  query: string;
  genreId: SearchGenreChipId;
  sort: SearchSortOption;
}

export const DEFAULT_SEARCH_FILTERS: SearchFiltersState = {
  query: '',
  genreId: DEFAULT_SEARCH_GENRE,
  sort: DEFAULT_SEARCH_SORT,
};

export function getSearchGenreLabel(genreId: SearchGenreChipId): string {
  return SEARCH_GENRE_CHIPS.find((chip) => chip.id === genreId)?.label ?? '';
}

export function buildEventSearchIndex(event: Event): string {
  return [event.title, event.venue, event.city, ...event.genres, ...event.artists]
    .join(' ')
    .toLowerCase();
}
