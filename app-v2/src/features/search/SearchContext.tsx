import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import {
  DEFAULT_SEARCH_FILTERS,
  ExploreTimeFilterId,
  SearchFiltersState,
  SearchGenreChipId,
} from './constants';

interface SearchContextValue extends SearchFiltersState {
  setQuery: (query: string) => void;
  setTimeFilter: (timeFilter: ExploreTimeFilterId) => void;
  setGenreId: (genreId: SearchGenreChipId) => void;
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
  const [query, setQuery] = useState(DEFAULT_SEARCH_FILTERS.query);
  const [timeFilter, setTimeFilter] = useState<ExploreTimeFilterId>(
    DEFAULT_SEARCH_FILTERS.timeFilter,
  );
  const [genreId, setGenreId] = useState<SearchGenreChipId>(DEFAULT_SEARCH_FILTERS.genreId);
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  const clearFilters = useCallback(() => {
    setQuery(DEFAULT_SEARCH_FILTERS.query);
    setTimeFilter(DEFAULT_SEARCH_FILTERS.timeFilter);
    setGenreId(DEFAULT_SEARCH_FILTERS.genreId);
  }, []);

  const requestSearchFocus = useCallback(() => {
    setShouldAutoFocus(true);
  }, []);

  const clearSearchFocus = useCallback(() => {
    setShouldAutoFocus(false);
  }, []);

  const value = useMemo<SearchContextValue>(
    () => ({
      query,
      timeFilter,
      genreId,
      setQuery,
      setTimeFilter,
      setGenreId,
      clearFilters,
      shouldAutoFocus,
      requestSearchFocus,
      clearSearchFocus,
    }),
    [
      query,
      timeFilter,
      genreId,
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
