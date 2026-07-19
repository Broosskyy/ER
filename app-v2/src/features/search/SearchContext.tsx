import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import {
  DEFAULT_SEARCH_FILTERS,
  type DateRangeFilter,
  type EventFilters,
  type SearchFiltersState,
  type SearchGenreChipId,
  type SortByFilter,
} from './constants';

interface SearchContextValue extends SearchFiltersState {
  filters: EventFilters;
  setQuery: (query: string) => void;
  setDateRange: (dateRange: DateRangeFilter) => void;
  setTimeFilter: (timeFilter: DateRangeFilter) => void;
  setGenreId: (genreId: SearchGenreChipId) => void;
  setCity: (city: string) => void;
  setSortBy: (sortBy: SortByFilter) => void;
  applyFilters: (filters: EventFilters) => void;
  clearFilters: () => void;
  shouldAutoFocus: boolean;
  requestSearchFocus: () => void;
  clearSearchFocus: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_SEARCH_FILTERS);
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  const setQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }));
  }, []);

  const setDateRange = useCallback((dateRange: DateRangeFilter) => {
    setFilters((current) => ({ ...current, dateRange }));
  }, []);

  const setTimeFilter = setDateRange;

  const setGenreId = useCallback((genreId: SearchGenreChipId) => {
    setFilters((current) => ({ ...current, genreId }));
  }, []);

  const setCity = useCallback((city: string) => {
    setFilters((current) => ({ ...current, city }));
  }, []);

  const setSortBy = useCallback((sortBy: SortByFilter) => {
    setFilters((current) => ({ ...current, sortBy }));
  }, []);

  const applyFilters = useCallback((next: EventFilters) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_SEARCH_FILTERS);
  }, []);

  const requestSearchFocus = useCallback(() => {
    setShouldAutoFocus(true);
  }, []);

  const clearSearchFocus = useCallback(() => {
    setShouldAutoFocus(false);
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      ...filters,
      query: filters.query,
      timeFilter: filters.dateRange,
      filters,
      setQuery,
      setDateRange,
      setTimeFilter,
      setGenreId,
      setCity,
      setSortBy,
      applyFilters,
      clearFilters,
      shouldAutoFocus,
      requestSearchFocus,
      clearSearchFocus,
    }),
    [
      filters,
      setQuery,
      setDateRange,
      setTimeFilter,
      setGenreId,
      setCity,
      setSortBy,
      applyFilters,
      clearFilters,
      shouldAutoFocus,
      requestSearchFocus,
      clearSearchFocus,
    ],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearchFilters(): SearchContextValue {
  const context = useContext(SearchContext);

  if (!context) {
    throw new Error('useSearchFilters must be used within a SearchProvider');
  }

  return context;
}
