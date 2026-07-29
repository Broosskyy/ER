import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUserLocation } from '@/features/location/UserLocationProvider';
import { useNetworkStatus } from '@/platform/network/use-network-status';

import {
  loadDiscoverySearchResults,
  loadMoreDiscoverySearchResults,
} from '../feed/discovery-search-client';
import type { DiscoverySearchLocationContext } from '../feed/search-feed-types';
import { trackSearchTelemetry } from '../feed/search-telemetry';
import { saveRecentSearch } from '../services/recent-search-storage';
import type { EventFilters } from '@/features/search/constants';
import { useDebouncedValue } from './use-debounced-value';

export interface UseDiscoverySearchOptions {
  debounceMs?: number;
  enabled?: boolean;
  pageSize?: number;
}

export interface UseDiscoverySearchResult {
  events: import('@/features/events/formatting/display-event').EventDisplayModel[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  totalMatched: number;
  isOnline: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useDiscoverySearch(
  filters: EventFilters,
  options: UseDiscoverySearchOptions = {},
): UseDiscoverySearchResult {
  const { debounceMs = 300, enabled = true, pageSize = 24 } = options;
  const debouncedFilters = useDebouncedValue(filters, debounceMs);
  const { location } = useUserLocation();
  const { isOnline } = useNetworkStatus();
  const [events, setEvents] = useState<import('@/features/events/formatting/display-event').EventDisplayModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalMatched, setTotalMatched] = useState(0);
  const cursorRef = useRef<import('@/features/discovery/domain/discovery-pagination-types').DiscoveryCursor | undefined>(undefined);
  const loadVersionRef = useRef(0);
  const lastQueryRef = useRef(filters.query);

  const locationContext = useMemo<DiscoverySearchLocationContext>(
    () => ({
      city: location?.city ?? debouncedFilters.city,
      latitude: location?.latitude,
      longitude: location?.longitude,
    }),
    [debouncedFilters.city, location?.city, location?.latitude, location?.longitude],
  );

  const filtersKey = useMemo(() => JSON.stringify(debouncedFilters), [debouncedFilters]);

  const loadInitial = useCallback(async () => {
    const loadVersion = ++loadVersionRef.current;
    setLoading(true);
    setError(null);
    cursorRef.current = undefined;

    try {
      const result = await loadDiscoverySearchResults(debouncedFilters, {
        limit: pageSize,
        bypassCache: true,
        location: locationContext,
      });

      if (loadVersion !== loadVersionRef.current) {
        return;
      }

      cursorRef.current = result.cursor;
      setEvents(result.events);
      setHasMore(result.hasMore);
      setTotalMatched(result.totalMatched);

      if (debouncedFilters.query.trim()) {
        await saveRecentSearch(debouncedFilters.query);
      }
    } catch (loadError) {
      if (loadVersion !== loadVersionRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Suche fehlgeschlagen.');
      setEvents([]);
      setHasMore(false);
      setTotalMatched(0);
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedFilters, locationContext, pageSize]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function load() {
      const loadVersion = ++loadVersionRef.current;
      setLoading(true);
      setError(null);
      cursorRef.current = undefined;

      try {
        const result = await loadDiscoverySearchResults(debouncedFilters, {
          limit: pageSize,
          bypassCache: true,
          location: locationContext,
        });

        if (cancelled || loadVersion !== loadVersionRef.current) {
          return;
        }

        cursorRef.current = result.cursor;
        setEvents(result.events);
        setHasMore(result.hasMore);
        setTotalMatched(result.totalMatched);

        if (debouncedFilters.query.trim()) {
          await saveRecentSearch(debouncedFilters.query);
        }
      } catch (loadError) {
        if (cancelled || loadVersion !== loadVersionRef.current) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Suche fehlgeschlagen.');
        setEvents([]);
        setHasMore(false);
        setTotalMatched(0);
      } finally {
        if (!cancelled && loadVersion === loadVersionRef.current) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (lastQueryRef.current.trim() && !filters.query.trim()) {
        trackSearchTelemetry('search_abandon', { query: lastQueryRef.current.trim() });
      }
      lastQueryRef.current = filters.query;
    };
  }, [debouncedFilters, enabled, filters.query, filtersKey, locationContext, pageSize]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInitial();
    } finally {
      setRefreshing(false);
    }
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursorRef.current) {
      return;
    }

    setLoadingMore(true);
    try {
      const result = await loadMoreDiscoverySearchResults(debouncedFilters, cursorRef.current, {
        limit: pageSize,
        location: locationContext,
      });
      cursorRef.current = result.cursor;
      setEvents((current) => [...current, ...result.events]);
      setHasMore(result.hasMore);
      setTotalMatched(result.totalMatched);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Weitere Ergebnisse konnten nicht geladen werden.');
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedFilters, hasMore, loadingMore, locationContext, pageSize]);

  const retry = useCallback(async () => {
    await loadInitial();
  }, [loadInitial]);

  return {
    events,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    totalMatched,
    isOnline,
    refresh,
    loadMore,
    retry,
  };
}
