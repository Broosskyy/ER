import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { EventMapPin } from '@/components/map/MapMarkers';
import { AppIcon } from '@/components/primitives/AppIcon';
import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import type { MapClub, MapEvent, MapLayerType } from '../types/discovery-models';
import type { MapMarkerSelection } from '../types/discovery-models';
import type { MapViewport } from '../types/discovery-models';
import { projectMarkerToCanvas, resolveMapPinStatus } from '../utils/map-discovery-selectors';

export interface MapDiscoverySurfaceProps {
  viewport: MapViewport;
  events: MapEvent[];
  clubs: MapClub[];
  layer: MapLayerType;
  selection: MapMarkerSelection | null;
  onSelectMarker: (selection: MapMarkerSelection) => void;
  onPanMap: (deltaLatitude: number, deltaLongitude: number) => void;
  onClearSelection: () => void;
}

export function MapDiscoverySurface({
  viewport,
  events,
  clubs,
  layer,
  selection,
  onSelectMarker,
  onPanMap,
  onClearSelection,
}: MapDiscoverySurfaceProps) {
  const { theme } = useTheme();
  const [layout, setLayout] = useStateSize();

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_, gesture) => {
          const latitudeShift = (-gesture.dy / Math.max(layout.height, 1)) * viewport.latitudeDelta;
          const longitudeShift = (gesture.dx / Math.max(layout.width, 1)) * viewport.longitudeDelta;
          onPanMap(latitudeShift, longitudeShift);
        },
      }),
    [layout.height, layout.width, onPanMap, viewport.latitudeDelta, viewport.longitudeDelta],
  );

  const surfaceColor =
    layer === 'satellite'
      ? '#1f2a22'
      : layer === 'dark'
        ? theme.colors.mapSurface
        : theme.colors.surfaceSubtle;

  return (
    <View
      testID="map-discovery-surface"
      style={[styles.container, { backgroundColor: surfaceColor }]}
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
      onStartShouldSetResponder={() => {
        onClearSelection();
        return false;
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.grid, { borderColor: theme.colors.borderSubtle }]} />
      <View style={styles.layerBadge}>
        <AppIcon name="layers-outline" size="sm" color={theme.colors.textSecondary} />
        <AppText role="caption" color={theme.colors.textSecondary}>
          {layer === 'standard' ? 'Standard' : layer === 'satellite' ? 'Satellite' : 'Dark Mode'}
        </AppText>
      </View>

      {events.map((event) => {
        const position = projectMarkerToCanvas(
          event.latitude,
          event.longitude,
          viewport,
          layout.width,
          layout.height,
        );

        return (
          <View
            key={event.id}
            style={[styles.marker, { left: position.left - 18, top: position.top - 18 }]}
          >
            <EventMapPin
              pin={{
                id: event.id,
                label: event.markerStatus === 'featured' ? '★' : undefined,
                status: resolveMapPinStatus(
                  event.markerStatus,
                  selection?.type === 'event' && selection.id === event.id,
                ),
                accessibilityLabel: `${event.title}, ${event.cityLabel}`,
              }}
              onPress={() => onSelectMarker({ type: 'event', id: event.id })}
            />
          </View>
        );
      })}

      {clubs.map((club) => {
        const position = projectMarkerToCanvas(
          club.latitude,
          club.longitude,
          viewport,
          layout.width,
          layout.height,
        );

        const selected = selection?.type === 'club' && selection.id === club.id;

        return (
          <View
            key={club.id}
            style={[styles.marker, { left: position.left - 18, top: position.top - 18 }]}
          >
            <EventMapPin
              pin={{
                id: club.id,
                label: 'Club',
                status: selected ? 'selected' : 'default',
                accessibilityLabel: `${club.title}, ${club.cityLabel}`,
              }}
              onPress={() => onSelectMarker({ type: 'club', id: club.id })}
            />
          </View>
        );
      })}
    </View>
  );
}

function useStateSize() {
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  return [layout, setLayout] as const;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  grid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  layerBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  marker: {
    position: 'absolute',
  },
});
