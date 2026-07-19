import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import {
  DEFAULT_EVENT_FILTERS,
  type DateRangeFilter,
  type EventFilters,
} from './constants';

interface SearchContextValue {
  filters: EventFilters;
  setQuery: (query: string) => void;
  setDateRange: (dateRange: DateRangeFilter) => void;
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
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  const setQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }));
  }, []);

  const setDateRange = useCallback((dateRange: DateRangeFilter) => {
    setFilters((current) => ({ ...current, dateRange }));
  }, []);

  const applyFilters = useCallback((next: EventFilters) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_EVENT_FILTERS);
  }, []);

  const requestSearchFocus = useCallback(() => {
    setShouldAutoFocus(true);
  }, []);

  const clearSearchFocus = useCallback(() => {
    setShouldAutoFocus(false);
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      filters,
      setQuery,
      setDateRange,
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
