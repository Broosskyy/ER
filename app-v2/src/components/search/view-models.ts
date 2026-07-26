/**
 * Presentation-only models for search and filter components.
 * Parents resolve labels, selection state, and callbacks before rendering.
 */

export type SearchSuggestionKind =
  | 'event'
  | 'city'
  | 'genre'
  | 'organizer'
  | 'club'
  | 'artist'
  | 'venue';

export interface SearchSuggestionViewModel {
  id: string;
  kind: SearchSuggestionKind;
  title: string;
  subtitleLabel?: string;
  badgeLabel?: string;
  accessibilityLabel: string;
}

export interface RecentSearchViewModel {
  id: string;
  title: string;
  subtitleLabel?: string;
  accessibilityLabel: string;
}

export interface TrendingSearchViewModel {
  id: string;
  title: string;
  badgeLabel?: string;
  trendLabel?: string;
  rank?: number;
  accessibilityLabel: string;
}

export type DateFilterOption = 'today' | 'tomorrow' | 'weekend' | 'date';

export interface DateFilterViewModel {
  id: DateFilterOption;
  label: string;
  selected?: boolean;
}

export interface GenreFilterViewModel {
  id: string;
  label: string;
  selected?: boolean;
}

export interface PriceFilterViewModel {
  id: string;
  label: string;
  selected?: boolean;
}

export interface DistanceFilterViewModel {
  id: string;
  label: string;
  selected?: boolean;
}

export interface CityFilterViewModel {
  id: string;
  cityLabel: string;
  selected?: boolean;
}

export interface VenueFilterViewModel {
  id: string;
  label: string;
  selected?: boolean;
}

export interface OrganizerFilterViewModel {
  id: string;
  label: string;
  selected?: boolean;
}

/**
 * Artist filter chips are not defined in current search mockups (09, 10, 13).
 * The view model exists for future extension; preview documents the gap.
 */
export interface ArtistFilterViewModel {
  id: string;
  label: string;
  selected?: boolean;
}

export type SortOption = 'distance' | 'date' | 'popularity' | 'new';

export interface SortViewModel {
  id: SortOption;
  label: string;
  selected?: boolean;
}

export interface ActiveFilterViewModel {
  id: string;
  label: string;
  count?: number;
}

export type SearchResultGroupKind = 'events' | 'organizers' | 'venues' | 'clubs';

export interface SearchResultGroupViewModel {
  kind: SearchResultGroupKind;
  title: string;
  count?: number;
  actionLabel?: string;
}

export interface FilterViewModel {
  genres: GenreFilterViewModel[];
  dates: DateFilterViewModel[];
  prices: PriceFilterViewModel[];
  distances: DistanceFilterViewModel[];
  cities: CityFilterViewModel[];
  venues: VenueFilterViewModel[];
  organizers: OrganizerFilterViewModel[];
  artists: ArtistFilterViewModel[];
}
