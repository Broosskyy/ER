/**
 * CMS / Supabase-ready filter option contracts.
 * UI and filter logic consume these shapes — never hardcode labels in components.
 */

export interface FilterOptionBase {
  id: string;
  label: string;
  value: string;
  active: boolean;
  icon?: string;
  sortOrder: number;
}

export interface DateOption extends FilterOptionBase {
  id: DateRangeFilterId;
}

export interface GenreOption extends FilterOptionBase {
  id: GenreFilterId;
}

export interface CityOption extends FilterOptionBase {
  id: CityFilterId;
}

export interface SortOption extends FilterOptionBase {
  id: SortByFilterId;
}

export type DateRangeFilterId = 'all-dates' | 'today' | 'this-weekend' | 'upcoming';

export type GenreFilterId =
  | 'techno'
  | 'hard-techno'
  | 'house'
  | 'trance'
  | 'psy'
  | 'industrial'
  | 'drum-and-bass';

export type CityFilterId = string;

export type SortByFilterId = 'recommended' | 'date' | 'alphabetical';

export interface FilterConfig {
  defaultCityId: CityFilterId;
  dateOptions: DateOption[];
  genreOptions: GenreOption[];
  cityOptions: CityOption[];
  sortOptions: SortOption[];
}
