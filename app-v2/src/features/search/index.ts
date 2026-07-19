export { SearchProvider, useSearchFilters } from './SearchContext';
export {
  DEFAULT_EVENT_FILTERS,
  filterConfig,
  getSearchGenreLabel,
} from './constants';
export type {
  DateRangeFilter,
  EventFilters,
  FilterConfig,
  GenreFilterId,
  SearchGenreChipId,
  SortByFilter,
} from './constants';
export {
  applyEventFilters,
  countActiveFilters,
  getActiveFilterSummaries,
  hasActiveFilters,
  isExploreMode,
  summarizeActiveFilters,
} from './utils/filter-events';
export {
  ExploreFeed,
  ExplorePosterGrid,
  FilterSheet,
  FilterSummaryBar,
  QuickFilterRow,
  SearchEmptyState,
  SearchInput,
  SearchResultsMeta,
} from './components';
