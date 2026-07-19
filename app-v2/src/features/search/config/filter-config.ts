import { appConfig } from '@/design/layout';

import type {
  CityOption,
  DateOption,
  FilterConfig,
  GenreOption,
  SortOption,
} from './filter-config.types';

/**
 * Local filter catalogue — replace with CMS / Supabase fetch at app bootstrap later.
 * All filter UI reads exclusively from this object.
 */
export const filterConfig: FilterConfig = {
  defaultCityId: 'koeln',

  dateOptions: [
    {
      id: 'all-dates',
      label: 'All Dates',
      value: 'all-dates',
      active: true,
      sortOrder: 0,
    },
    {
      id: 'today',
      label: 'Today',
      value: 'today',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'this-weekend',
      label: 'This Weekend',
      value: 'this-weekend',
      active: true,
      sortOrder: 2,
    },
    {
      id: 'upcoming',
      label: 'Upcoming',
      value: 'upcoming',
      active: true,
      sortOrder: 3,
    },
  ],

  genreOptions: [
    { id: 'techno', label: 'Techno', value: 'techno', active: true, sortOrder: 0 },
    { id: 'hard-techno', label: 'Hard Techno', value: 'hard-techno', active: true, sortOrder: 1 },
    { id: 'house', label: 'House', value: 'house', active: true, sortOrder: 2 },
    { id: 'trance', label: 'Trance', value: 'trance', active: true, sortOrder: 3 },
    { id: 'psy', label: 'Psy', value: 'psy', active: true, sortOrder: 4 },
    { id: 'industrial', label: 'Industrial', value: 'industrial', active: true, sortOrder: 5 },
    { id: 'drum-and-bass', label: 'Drum & Bass', value: 'drum-and-bass', active: true, sortOrder: 6 },
  ],

  cityOptions: [
    {
      id: 'koeln',
      label: 'Köln',
      value: appConfig.defaultCity,
      active: true,
      sortOrder: 0,
    },
    {
      id: 'berlin',
      label: 'Berlin',
      value: 'Berlin',
      active: true,
      sortOrder: 1,
    },
  ],

  sortOptions: [
    {
      id: 'recommended',
      label: 'Recommended',
      value: 'recommended',
      active: true,
      sortOrder: 0,
    },
    {
      id: 'date',
      label: 'Date',
      value: 'date',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'alphabetical',
      label: 'Alphabetical',
      value: 'alphabetical',
      active: true,
      sortOrder: 2,
    },
  ],
};

export function getActiveDateOptions(): DateOption[] {
  return filterConfig.dateOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveGenreOptions(): GenreOption[] {
  return filterConfig.genreOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveCityOptions(): CityOption[] {
  return filterConfig.cityOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveSortOptions(): SortOption[] {
  return filterConfig.sortOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getDefaultCityValue(): string {
  const defaultCity = filterConfig.cityOptions.find(
    (city) => city.id === filterConfig.defaultCityId,
  );
  return defaultCity?.value ?? appConfig.defaultCity;
}

export function getGenreLabel(genreId: string): string {
  return filterConfig.genreOptions.find((genre) => genre.id === genreId)?.label ?? genreId;
}

export function getDateLabel(dateRange: string): string {
  return filterConfig.dateOptions.find((option) => option.id === dateRange)?.label ?? dateRange;
}

export function getSortLabel(sortBy: string): string {
  return filterConfig.sortOptions.find((option) => option.id === sortBy)?.label ?? sortBy;
}

export function getQuickDateOptions(): DateOption[] {
  return getActiveDateOptions().filter((option) =>
    ['today', 'this-weekend'].includes(option.id),
  );
}
