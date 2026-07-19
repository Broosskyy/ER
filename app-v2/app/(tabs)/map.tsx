import { useRouter } from 'expo-router';
import { Component, ReactNode, useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components';
import { appConfig, layout } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import {
  MapEmptyState,
  MapErrorState,
  MapEventMarker,
  MapEventPreview,
  MapHeaderOverlay,
  eternalRaveMapStyle,
  getInitialMapRegion,
  isAndroidMapConfigured,
  isRenderableCoordinate,
  resolveMapCityLabel,
  sanitizeMapRegion,
} from '@/features/map';

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

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const canRenderNativeMap = isAndroidMapConfigured();

  const mapEvents = useMemo(() => {
    return eventRepository
      .getEventsForMap()
      .map((event) => toEventDisplayModel(event))
      .filter(
        (event): event is EventDisplayModel & { latitude: number; longitude: number } =>
          isRenderableCoordinate(event.latitude, event.longitude),
      );
  }, []);

  const initialRegion = useMemo(
    () => sanitizeMapRegion(getInitialMapRegion(mapEvents, appConfig.defaultCity)),
    [mapEvents],
  );
  const cityLabel = resolveMapCityLabel(appConfig.defaultCity);

  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);
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

  const handleExploreEvents = useCallback(() => {
    router.navigate('/(tabs)/search');
  }, [router]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    setMapLoadFailed(false);
  }, []);

  const handleMapFailure = useCallback(() => {
    setMapLoadFailed(true);
    setMapReady(false);
  }, []);

  const handleRetryMap = useCallback(() => {
    setMapLoadFailed(false);
    setMapReady(false);
    setSelectedEventId(null);
    setRetryKey((current) => current + 1);
  }, []);

  if (!canRenderNativeMap || mapLoadFailed) {
    return (
      <AppScreen>
        <MapErrorState onRetry={handleRetryMap} />
      </AppScreen>
    );
  }

  if (mapEvents.length === 0) {
    return (
      <AppScreen>
        <MapEmptyState onExploreEvents={handleExploreEvents} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
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

        {mapReady ? (
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
    </AppScreen>
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
