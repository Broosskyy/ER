import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUserLocation } from '@/features/location/UserLocationProvider';
import { resolveDiscoveryCityLabel } from '@/features/location/resolve-discovery-city';
import { useHomeRadiusPreference } from '@/features/location/hooks/use-home-radius-preference';
import { useNetworkStatus } from '@/platform/network/use-network-status';

import {
  loadHomeFeedSection,
  loadHomeFeedSectionsParallel,
} from '../feed/discovery-feed-client';
import { getVisibleHomeFeedSections } from '../feed/home-feed-section-config';
import { trackHomeFeedTelemetry } from '../feed/home-feed-telemetry';
import type {
  HomeFeedLocationContext,
  HomeFeedSectionDefinition,
  HomeFeedSectionState,
} from '../feed/home-feed-types';

function createEmptySectionState(id: string): HomeFeedSectionState {
  return {
    id,
    events: [],
    loading: true,
    error: null,
    hasMore: false,
    totalMatched: 0,
  };
}

export interface UseHomeFeedResult {
  sections: HomeFeedSectionState[];
  sectionDefinitions: HomeFeedSectionDefinition[];
  initialLoading: boolean;
  refreshing: boolean;
  isOnline: boolean;
  locationContext: HomeFeedLocationContext;
  refresh: () => Promise<void>;
  retrySection: (sectionId: string) => Promise<void>;
  hasVisibleContent: boolean;
  allSectionsEmpty: boolean;
}

export function useHomeFeed(): UseHomeFeedResult {
  const { location } = useUserLocation();
  const { radiusKm } = useHomeRadiusPreference();
  const { isOnline } = useNetworkStatus();
  const sectionDefinitions = useMemo(() => getVisibleHomeFeedSections(), []);
  const [sectionsById, setSectionsById] = useState<Record<string, HomeFeedSectionState>>(() =>
    Object.fromEntries(sectionDefinitions.map((section) => [section.id, createEmptySectionState(section.id)])),
  );
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadVersionRef = useRef(0);

  const locationContext = useMemo<HomeFeedLocationContext>(
    () => ({
      city: resolveDiscoveryCityLabel(location),
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusKm,
    }),
    [location, radiusKm],
  );

  const applySectionResult = useCallback(
    (section: HomeFeedSectionDefinition, result: Awaited<ReturnType<typeof loadHomeFeedSection>>) => {
      setSectionsById((current) => ({
        ...current,
        [section.id]: {
          id: section.id,
          events: result.events,
          loading: false,
          error: null,
          hasMore: result.hasMore,
          cursor: result.cursor,
          totalMatched: result.totalMatched,
        },
      }));
    },
    [],
  );

  const applySectionError = useCallback((sectionId: string, message: string) => {
    setSectionsById((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] ?? createEmptySectionState(sectionId)),
        loading: false,
        error: message,
      },
    }));
  }, []);

  const loadAllSections = useCallback(
    async (options: { bypassCache?: boolean } = {}) => {
      const loadVersion = ++loadVersionRef.current;
      setInitialLoading(true);
      setSectionsById((current) =>
        Object.fromEntries(
          sectionDefinitions.map((section) => [
            section.id,
            { ...createEmptySectionState(section.id), loading: true, error: null },
          ]),
        ),
      );

      const results = await loadHomeFeedSectionsParallel(sectionDefinitions, locationContext, options);
      if (loadVersion !== loadVersionRef.current) {
        return;
      }

      for (const section of sectionDefinitions) {
        const result = results[section.id];
        if (result) {
          applySectionResult(section, result);
        } else {
          applySectionError(section.id, 'Section konnte nicht geladen werden.');
        }
      }
    },
    [applySectionError, applySectionResult, locationContext, sectionDefinitions],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      const loadVersion = ++loadVersionRef.current;
      setInitialLoading(true);
      setSectionsById(
        Object.fromEntries(
          sectionDefinitions.map((section) => [
            section.id,
            { ...createEmptySectionState(section.id), loading: true, error: null },
          ]),
        ),
      );

      const results = await loadHomeFeedSectionsParallel(sectionDefinitions, locationContext);
      if (!active || loadVersion !== loadVersionRef.current) {
        return;
      }

      for (const section of sectionDefinitions) {
        const result = results[section.id];
        setSectionsById((current) => ({
          ...current,
          [section.id]: result
            ? {
                id: section.id,
                events: result.events,
                loading: false,
                error: null,
                hasMore: result.hasMore,
                cursor: result.cursor,
                totalMatched: result.totalMatched,
              }
            : {
                ...(current[section.id] ?? createEmptySectionState(section.id)),
                loading: false,
                error: 'Section konnte nicht geladen werden.',
              },
        }));
      }

      setInitialLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [locationContext, sectionDefinitions]);

  const refresh = useCallback(async () => {
    trackHomeFeedTelemetry('feed_refresh_start');
    setRefreshing(true);
    try {
      await loadAllSections({ bypassCache: true });
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
      trackHomeFeedTelemetry('feed_refresh_complete');
    }
  }, [loadAllSections]);

  const retrySection = useCallback(
    async (sectionId: string) => {
      const section = sectionDefinitions.find((item) => item.id === sectionId);
      if (!section) {
        return;
      }

      setSectionsById((current) => ({
        ...current,
        [sectionId]: {
          ...(current[sectionId] ?? createEmptySectionState(sectionId)),
          loading: true,
          error: null,
        },
      }));

      try {
        const result = await loadHomeFeedSection(section, locationContext, { bypassCache: true });
        applySectionResult(section, result);
      } catch (error) {
        applySectionError(
          sectionId,
          error instanceof Error ? error.message : 'Section konnte nicht geladen werden.',
        );
      }
    },
    [applySectionError, applySectionResult, locationContext, sectionDefinitions],
  );

  const sections = useMemo(
    () => sectionDefinitions.map((section) => sectionsById[section.id] ?? createEmptySectionState(section.id)),
    [sectionDefinitions, sectionsById],
  );

  const hasVisibleContent = sections.some((section) => section.events.length > 0);
  const allSectionsEmpty =
    !initialLoading && sections.every((section) => !section.loading && section.events.length === 0);

  return {
    sections,
    sectionDefinitions,
    initialLoading,
    refreshing,
    isOnline,
    locationContext,
    refresh,
    retrySection,
    hasVisibleContent,
    allSectionsEmpty,
  };
}
