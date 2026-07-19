import { Component, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appConfig } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import { eternalRaveMapStyle } from '@/features/map/map-style-dark';
import { getMapLoadTimeoutMs } from '@/features/map/map-tiles';
import { getInitialMapRegion, resolveMapCityLabel } from '@/features/map/constants';
import { isRenderableCoordinate, sanitizeMapRegion } from '@/features/map/utils/coordinates';
import { MapEmptyState, MapErrorState } from '@/features/map/components/MapEmptyState';
import { MapEventPreview } from '@/features/map/components/MapEventPreview';
import { MapHeaderOverlay } from '@/features/map/components/MapHeaderOverlay';
import { MapLoadingOverlay } from '@/features/map/components/MapLoadingOverlay';
import { MapEventMarker } from '@/features/map/components/MapEventMarker';
import { getBottomTabBarHeight } from '@/platform/tab-bar-insets';

type MapLoadStatus = 'loading' | 'loaded' | 'error';

interface MapErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export interface NativeEventMapProps {
  onExploreEvents: () => void;
}

export default function NativeEventMap({ onExploreEvents }: NativeEventMapProps) {
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapLoadStatus>('loading');
  const [retryKey, setRetryKey] = useState(0);

  const mapEvents = useMemo(() => {
    return eventRepository
      .getEventsForMap()
      .map((event) => toEventDisplayModel(event))
      .filter(
        (event): event is EventDisplayModel & { latitude: number; longitude: number } =>
          isRenderableCoordinate(event.latitude, event.longitude) &&
          Boolean(event.id),
      );
  }, []);

  const initialRegion = useMemo(
    () => sanitizeMapRegion(getInitialMapRegion(mapEvents, appConfig.defaultCity)),
    [mapEvents],
  );
  const cityLabel = resolveMapCityLabel(appConfig.defaultCity);

  const tabBarHeight = getBottomTabBarHeight(insets);
  const previewBottomInset = tabBarHeight + spacing.md;

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return undefined;
    }

    const event = eventRepository.getEventById(selectedEventId);

    if (!event) {
      return undefined;
    }

    const display = toEventDisplayModel(event);

    if (!isRenderableCoordinate(display.latitude, display.longitude)) {
      return undefined;
    }

    return display;
  }, [selectedEventId]);

  const handleMapReady = useCallback(() => {
    setMapStatus('loaded');
  }, []);

  const handleMapFailure = useCallback(() => {
    setMapStatus('error');
  }, []);

  const handleRetryMap = useCallback(() => {
    setMapStatus('loading');
    setSelectedEventId(null);
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (mapStatus !== 'loading') {
      return;
    }

    const timeout = setTimeout(() => {
      setMapStatus((current) => (current === 'loading' ? 'error' : current));
    }, getMapLoadTimeoutMs());

    return () => clearTimeout(timeout);
  }, [mapStatus, retryKey]);

  if (mapStatus === 'error') {
    return <MapErrorState onRetry={handleRetryMap} onExploreEvents={onExploreEvents} />;
  }

  if (mapEvents.length === 0) {
    return <MapEmptyState onExploreEvents={onExploreEvents} />;
  }

  return (
    <View style={styles.container}>
      <MapErrorBoundary onError={handleMapFailure}>
        <MapView
          key={retryKey}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion as Region}
          customMapStyle={Platform.OS === 'android' ? [...eternalRaveMapStyle] : undefined}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onPress={() => setSelectedEventId(null)}
          onMapReady={handleMapReady}
          onMapLoaded={handleMapReady}
        >
          {mapEvents.map((event) => (
            <MapEventMarker
              key={event.id}
              event={event}
              selected={selectedEventId === event.id}
              onSelect={setSelectedEventId}
            />
          ))}
        </MapView>
      </MapErrorBoundary>

      {mapStatus === 'loading' ? <MapLoadingOverlay /> : null}

      {mapStatus === 'loaded' ? (
        <>
          <MapHeaderOverlay cityLabel={cityLabel} eventCount={mapEvents.length} />
          {selectedEvent ? (
            <MapEventPreview
              event={selectedEvent}
              isFavorite={isHydrated && isFavorite(selectedEvent.id)}
              onToggleFavorite={() => toggleFavorite(selectedEvent.id)}
              onClose={() => setSelectedEventId(null)}
              bottomInset={previewBottomInset}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121a',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
});
