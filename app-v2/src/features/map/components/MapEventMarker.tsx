import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors } from '@/design/colors';
import { DemoEvent } from '@/features/events/data/demo-events';

export interface MapEventMarkerProps {
  event: DemoEvent & { latitude: number; longitude: number };
  selected: boolean;
  onSelect: (eventId: string) => void;
}

export const MapEventMarker = memo(function MapEventMarker({
  event,
  selected,
  onSelect,
}: MapEventMarkerProps) {
  return (
    <Marker
      identifier={event.id}
      coordinate={{ latitude: event.latitude, longitude: event.longitude }}
      onPress={(pressEvent) => {
        pressEvent.stopPropagation();
        onSelect(event.id);
      }}
      tracksViewChanges={false}
    >
      <View style={[styles.marker, selected && styles.markerSelected]} />
    </Marker>
  );
});

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 3,
    borderColor: colors.textSecondary,
  },
  markerSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderColor: colors.textOnPrimary,
  },
});
