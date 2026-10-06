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

export type SortByFilterId =
  | 'recommended'
  | 'date'
  | 'alphabetical'
  | 'distance'
  | 'newest'
  | 'trending';

export type DistanceFilterId = 'any' | '5' | '10' | '25' | '50' | '100';

export type PriceFilterId = 'any' | 'free' | 'under-20' | 'under-50';

export type VenueEnvironmentFilterId = 'any' | 'indoor' | 'outdoor';

export interface DistanceOption extends FilterOptionBase {
  id: DistanceFilterId;
  radiusKm: number | null;
}

export interface PriceOption extends FilterOptionBase {
  id: PriceFilterId;
  freeOnly?: boolean;
  maxPriceEur?: number;
}

export interface VenueEnvironmentOption extends FilterOptionBase {
  id: VenueEnvironmentFilterId;
  indoor?: boolean;
  outdoor?: boolean;
}

export interface EntityFilterOption extends FilterOptionBase {
  entityId: string | null;
}

export interface FilterConfig {
  defaultCityId: CityFilterId;
  dateOptions: DateOption[];
  genreOptions: GenreOption[];
  cityOptions: CityOption[];
  sortOptions: SortOption[];
  distanceOptions: DistanceOption[];
  priceOptions: PriceOption[];
  venueEnvironmentOptions: VenueEnvironmentOption[];
  venueOptions: EntityFilterOption[];
  organizerOptions: EntityFilterOption[];
  festivalOptions: EntityFilterOption[];
}
