import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import {
  DEFAULT_SEARCH_FILTERS,
  SearchFiltersState,
  SearchGenreChipId,
  SearchSortOption,
} from './constants';

interface SearchContextValue extends SearchFiltersState {
  setQuery: (query: string) => void;
  setGenreId: (genreId: SearchGenreChipId) => void;
  setSort: (sort: SearchSortOption) => void;
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
  const [genreId, setGenreId] = useState<SearchGenreChipId>(DEFAULT_SEARCH_FILTERS.genreId);
  const [sort, setSort] = useState<SearchSortOption>(DEFAULT_SEARCH_FILTERS.sort);
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  const clearFilters = useCallback(() => {
    setQuery(DEFAULT_SEARCH_FILTERS.query);
    setGenreId(DEFAULT_SEARCH_FILTERS.genreId);
    setSort(DEFAULT_SEARCH_FILTERS.sort);
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
      genreId,
      sort,
      setQuery,
      setGenreId,
      setSort,
      clearFilters,
      shouldAutoFocus,
      requestSearchFocus,
      clearSearchFocus,
    }),
    [
      query,
      genreId,
      sort,
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
