import { appConfig } from '@/design/layout';

import type {
  CityOption,
  DateOption,
  DistanceOption,
  EntityFilterOption,
  FilterConfig,
  GenreOption,
  PriceOption,
  SortOption,
  VenueEnvironmentOption,
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
      label: 'Alle Termine',
      value: 'all-dates',
      active: true,
      sortOrder: 0,
    },
    {
      id: 'today',
      label: 'Heute',
      value: 'today',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'this-weekend',
      label: 'Dieses Wochenende',
      value: 'this-weekend',
      active: true,
      sortOrder: 2,
    },
    {
      id: 'upcoming',
      label: 'Demnächst',
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
      label: 'Relevanz',
      value: 'recommended',
      active: true,
      sortOrder: 0,
    },
    {
      id: 'distance',
      label: 'Entfernung',
      value: 'distance',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'date',
      label: 'Datum',
      value: 'date',
      active: true,
      sortOrder: 2,
    },
    {
      id: 'newest',
      label: 'Neu',
      value: 'newest',
      active: true,
      sortOrder: 3,
    },
    {
      id: 'trending',
      label: 'Trending',
      value: 'trending',
      active: true,
      sortOrder: 4,
    },
    {
      id: 'alphabetical',
      label: 'Alphabetisch',
      value: 'alphabetical',
      active: true,
      sortOrder: 5,
    },
  ],

  distanceOptions: [
    { id: 'any', label: 'Beliebig', value: 'any', active: true, sortOrder: 0, radiusKm: null },
    { id: '5', label: '5 km', value: '5', active: true, sortOrder: 1, radiusKm: 5 },
    { id: '10', label: '10 km', value: '10', active: true, sortOrder: 2, radiusKm: 10 },
    { id: '25', label: '25 km', value: '25', active: true, sortOrder: 3, radiusKm: 25 },
    { id: '50', label: '50 km', value: '50', active: true, sortOrder: 4, radiusKm: 50 },
    { id: '100', label: '100 km', value: '100', active: true, sortOrder: 5, radiusKm: 100 },
  ],

  priceOptions: [
    { id: 'any', label: 'Beliebig', value: 'any', active: true, sortOrder: 0 },
    { id: 'free', label: 'Kostenlos', value: 'free', active: true, sortOrder: 1, freeOnly: true },
    { id: 'under-20', label: 'Bis 20 €', value: 'under-20', active: true, sortOrder: 2, maxPriceEur: 20 },
    { id: 'under-50', label: 'Bis 50 €', value: 'under-50', active: true, sortOrder: 3, maxPriceEur: 50 },
  ],

  venueEnvironmentOptions: [
    { id: 'any', label: 'Beliebig', value: 'any', active: true, sortOrder: 0 },
    { id: 'indoor', label: 'Indoor', value: 'indoor', active: true, sortOrder: 1, indoor: true },
    { id: 'outdoor', label: 'Outdoor', value: 'outdoor', active: true, sortOrder: 2, outdoor: true },
  ],

  venueOptions: [
    { id: 'any', label: 'Beliebig', value: 'any', active: true, sortOrder: 0, entityId: null },
    { id: 'bootshaus', label: 'Bootshaus', value: 'bootshaus', active: true, sortOrder: 1, entityId: 'venue-bootshaus' },
    { id: 'warehouse', label: 'Warehouse', value: 'warehouse', active: true, sortOrder: 2, entityId: 'venue-warehouse' },
  ],

  organizerOptions: [
    { id: 'any', label: 'Beliebig', value: 'any', active: true, sortOrder: 0, entityId: null },
    { id: 'er-collective', label: 'ER Collective', value: 'er-collective', active: true, sortOrder: 1, entityId: 'org-er-collective' },
  ],

  festivalOptions: [
    { id: 'any', label: 'Beliebig', value: 'any', active: true, sortOrder: 0, entityId: null },
    { id: 'rave-summer', label: 'Rave Summer', value: 'rave-summer', active: true, sortOrder: 1, entityId: 'festival-rave-summer' },
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

export function getActiveDistanceOptions(): DistanceOption[] {
  return filterConfig.distanceOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActivePriceOptions(): PriceOption[] {
  return filterConfig.priceOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveVenueEnvironmentOptions(): VenueEnvironmentOption[] {
  return filterConfig.venueEnvironmentOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveVenueOptions(): EntityFilterOption[] {
  return filterConfig.venueOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveOrganizerOptions(): EntityFilterOption[] {
  return filterConfig.organizerOptions
    .filter((option) => option.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getActiveFestivalOptions(): EntityFilterOption[] {
  return filterConfig.festivalOptions
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
