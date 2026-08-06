import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventFilters } from '@/features/search/constants';

import type { UniversalSearchGroupedResults } from '../domain/universal-search-types';
import { filterGroupedResultsByTab, loadUniversalSearchResults } from '../feed/universal-search-client';
import type { UseDiscoverySearchOptions, UseDiscoverySearchResult } from './use-discovery-search';
import { useDiscoverySearch } from './use-discovery-search';

export interface UseUniversalSearchResult extends UseDiscoverySearchResult {
  grouped: UniversalSearchGroupedResults | null;
  visibleEvents: EventDisplayModel[];
  loadingGrouped: boolean;
}

export function useUniversalSearch(
  filters: EventFilters,
  options: UseDiscoverySearchOptions = {},
): UseUniversalSearchResult {
  const discovery = useDiscoverySearch(filters, options);
  const [grouped, setGrouped] = useState<UniversalSearchGroupedResults | null>(null);
  const [loadingGrouped, setLoadingGrouped] = useState(false);

  const hasQuery = filters.query.trim().length > 0;

  const loadGrouped = useCallback(async () => {
    if (!hasQuery) {
      setGrouped(null);
      return;
    }

    setLoadingGrouped(true);
    try {
      const result = await loadUniversalSearchResults(filters);
      setGrouped(result);
    } catch {
      setGrouped(null);
    } finally {
      setLoadingGrouped(false);
    }
  }, [filters, hasQuery]);

  useEffect(() => {
    if (!hasQuery || discovery.loading) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadGrouped();
    }, 0);
    return () => clearTimeout(timeout);
  }, [discovery.loading, hasQuery, loadGrouped]);

  const visible = useMemo(() => {
    if (!grouped) {
      return {
        events: discovery.events,
        artists: [],
        venues: [],
        organizers: [],
      };
    }

    return filterGroupedResultsByTab(grouped, filters.entityTab);
  }, [discovery.events, filters.entityTab, grouped]);

  return {
    ...discovery,
    grouped,
    visibleEvents: visible.events,
    loadingGrouped,
  };
}
