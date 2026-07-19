import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components';
import { appConfig, layout } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { getDemoEventById, getMapDemoEvents } from '@/features/events/data/demo-events';
import { useFavorites } from '@/features/favorites';
import {
  MapEmptyState,
  MapEventMarker,
  MapEventPreview,
  MapHeaderOverlay,
  eternalRaveMapStyle,
  getInitialMapRegion,
  resolveMapCityLabel,
} from '@/features/map';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapEvents = useMemo(() => getMapDemoEvents(), []);
  const initialRegion = useMemo(
    () => getInitialMapRegion(mapEvents, appConfig.defaultCity),
    [mapEvents],
  );
  const cityLabel = resolveMapCityLabel(appConfig.defaultCity);

  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);
  const previewBottomInset = tabBarHeight + spacing.md;

  const selectedEvent = selectedEventId ? getDemoEventById(selectedEventId) : undefined;

  const handleExploreEvents = useCallback(() => {
    router.navigate('/(tabs)/search');
  }, [router]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

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
        <MapView
          style={styles.map}
          initialRegion={initialRegion as Region}
          customMapStyle={[...eternalRaveMapStyle]}
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

        {mapReady ? (
          <>
            <MapHeaderOverlay cityLabel={cityLabel} eventCount={mapEvents.length} />
            {selectedEvent ? (
              <MapEventPreview
                event={selectedEvent}
                isFavorite={isFavorite(selectedEvent.id)}
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
