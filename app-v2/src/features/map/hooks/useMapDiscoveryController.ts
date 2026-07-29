import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EventFilters } from '@/features/search/constants';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { useDiscoverySearch } from '@/features/search/hooks/use-discovery-search';

import { DEFAULT_MAP_FILTER, type MapFilter, type MapLayerType, type MapMarkerSelection, type MapViewport } from '../types/discovery-models';
import {
  buildMapClubs,
  buildMapEvents,
  findMapClub,
  findMapEvent,
  resolveInitialMapViewport,
  shiftViewport,
} from '../utils/map-discovery-selectors';

export type MapPresentationState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'offline'
  | 'no_permission'
  | 'location_unknown';

export interface UseMapDiscoveryControllerOptions {
  filters: EventFilters;
  featuredIds?: string[];
  simulateOffline?: boolean;
  simulateError?: boolean;
}

export function useMapDiscoveryController({
  filters,
  featuredIds,
  simulateOffline = false,
  simulateError = false,
}: UseMapDiscoveryControllerOptions) {
  const { location, status, requestCurrentLocation } = useUserLocation();
  const { events: discoveryEvents } = useDiscoverySearch(filters);
  const [mapFilter, setMapFilter] = useState<MapFilter>(DEFAULT_MAP_FILTER);
  const [layer, setLayer] = useState<MapLayerType>('standard');
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [selection, setSelection] = useState<MapMarkerSelection | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [searchAreaApplied, setSearchAreaApplied] = useState(false);

  const origin = useMemo(() => {
    if (!location) {
      return undefined;
    }

    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }, [location]);

  const mapEvents = useMemo(
    () => buildMapEvents(discoveryEvents, mapFilter, { featuredIds, origin }),
    [discoveryEvents, mapFilter, featuredIds, origin],
  );

  const mapClubs = useMemo(
    () => buildMapClubs(origin, filters.city),
    [filters.city, origin],
  );

  const selectedEvent = useMemo(
    () => (selection?.type === 'event' ? findMapEvent(mapEvents, selection.id) : undefined),
    [mapEvents, selection],
  );

  const selectedClub = useMemo(
    () => (selection?.type === 'club' ? findMapClub(mapClubs, selection.id) : undefined),
    [mapClubs, selection],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setViewport((current) =>
        current ??
        resolveInitialMapViewport(mapEvents, filters.city, origin),
      );
      setIsBootstrapping(false);
    }, 350);

    return () => clearTimeout(timeout);
  }, [filters.city, mapEvents, origin]);

  const presentationState = useMemo<MapPresentationState>(() => {
    if (simulateOffline) {
      return 'offline';
    }

    if (simulateError) {
      return 'error';
    }

    if (isBootstrapping || status === 'loading') {
      return 'loading';
    }

    if (mapEvents.length === 0 && mapClubs.length === 0) {
      return 'empty';
    }

    return 'ready';
  }, [isBootstrapping, mapClubs.length, mapEvents.length, simulateError, simulateOffline, status]);

  const locationPresentation = useMemo<'unknown' | 'denied' | 'ready'>(() => {
    if (status === 'denied') {
      return 'denied';
    }

    if (!location) {
      return 'unknown';
    }

    return 'ready';
  }, [location, status]);

  const handleSelectMarker = useCallback((next: MapMarkerSelection) => {
    setSelection(next);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const handlePanMap = useCallback((deltaLatitude: number, deltaLongitude: number) => {
    setViewport((current) => {
      if (!current) {
        return current;
      }

      return shiftViewport(current, deltaLatitude, deltaLongitude);
    });
    setMapMoved(true);
    setSearchAreaApplied(false);
  }, []);

  const handleRecenter = useCallback(async () => {
    if (origin) {
      setViewport(resolveInitialMapViewport(mapEvents, filters.city, origin));
      setMapMoved(false);
      setSearchAreaApplied(false);
      return;
    }

    await requestCurrentLocation();
  }, [filters.city, mapEvents, origin, requestCurrentLocation]);

  const handleSearchInArea = useCallback(() => {
    setMapMoved(false);
    setSearchAreaApplied(true);
  }, []);

  const handleApplyMapFilter = useCallback((next: MapFilter) => {
    setMapFilter(next);
  }, []);

  const handleCycleLayer = useCallback(() => {
    setLayer((current) => {
      if (current === 'standard') {
        return 'satellite';
      }

      if (current === 'satellite') {
        return 'dark';
      }

      return 'standard';
    });
  }, []);

  const recenterState = useMemo(() => {
    if (status === 'loading') {
      return 'loading' as const;
    }

    if (status === 'denied') {
      return 'permission_required' as const;
    }

    if (!origin) {
      return 'permission_required' as const;
    }

    return 'default' as const;
  }, [origin, status]);

  return {
    mapFilter,
    layer,
    viewport,
    mapEvents,
    mapClubs,
    selection,
    selectedEvent,
    selectedClub,
    mapMoved,
    searchAreaApplied,
    presentationState,
    recenterState,
    origin,
    locationStatus: status,
    handleSelectMarker,
    handleClearSelection,
    handlePanMap,
    handleRecenter,
    handleSearchInArea,
    handleApplyMapFilter,
    handleCycleLayer,
    locationPresentation,
    requestCurrentLocation,
  };
}
