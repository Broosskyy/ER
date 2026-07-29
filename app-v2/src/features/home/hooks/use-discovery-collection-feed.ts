import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CollectionType } from '@/features/collections/event-collection-config';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { useNetworkStatus } from '@/platform/network/use-network-status';

import { loadHomeFeedSection, loadMoreHomeFeedSection } from '../feed/discovery-feed-client';
import { getCollectionFeedSection } from '../feed/home-feed-section-config';
import type { HomeFeedLocationContext } from '../feed/home-feed-types';

export interface UseDiscoveryCollectionFeedResult {
  events: EventDisplayModel[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  isOnline: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useDiscoveryCollectionFeed(type: CollectionType): UseDiscoveryCollectionFeedResult {
  const section = useMemo(() => getCollectionFeedSection(type), [type]);
  const { location } = useUserLocation();
  const { isOnline } = useNetworkStatus();
  const [events, setEvents] = useState<EventDisplayModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<import('@/features/discovery/domain/discovery-pagination-types').DiscoveryCursor | undefined>(undefined);

  const locationContext = useMemo<HomeFeedLocationContext>(
    () => ({
      city: location?.city,
      latitude: location?.latitude,
      longitude: location?.longitude,
    }),
    [location?.city, location?.latitude, location?.longitude],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadHomeFeedSection(section, locationContext, {
        limit: section.previewLimit,
        bypassCache: true,
      });
      cursorRef.current = result.cursor;
      setEvents(result.events);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Events konnten nicht geladen werden.');
      setEvents([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [locationContext, section]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await loadHomeFeedSection(section, locationContext, {
          limit: section.previewLimit,
          bypassCache: true,
        });
        if (cancelled) {
          return;
        }
        cursorRef.current = result.cursor;
        setEvents(result.events);
        setHasMore(result.hasMore);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Events konnten nicht geladen werden.');
        setEvents([]);
        setHasMore(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locationContext, section]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = undefined;
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
      const result = await loadMoreHomeFeedSection(
        section,
        locationContext,
        cursorRef.current,
        section.previewLimit,
      );
      cursorRef.current = result.cursor;
      setEvents((current) => [...current, ...result.events]);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Weitere Events konnten nicht geladen werden.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, locationContext, section]);

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
    isOnline,
    refresh,
    loadMore,
    retry,
  };
}
