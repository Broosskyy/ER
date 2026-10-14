import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { spacingRoles } from '@/design/spacing';
import { EventDiscoveryCard } from '@/features/events/components/EventDiscoveryCard';
import { usePublishedEvents } from '@/features/events/hooks/usePublishedEvents';
import { useFavoriteToggle } from '@/features/favorites';
import { useHomeRadiusPreference } from '@/features/location/hooks/use-home-radius-preference';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { calculateDistanceKm } from '@/features/location/utils/geo-distance';

function normalizeCity(value?: string): string {
  return (value ?? '').trim().toLocaleLowerCase('de-DE');
}

export function HomeFeedContent() {
  const { events } = usePublishedEvents();
  const { location } = useUserLocation();
  const { radiusKm } = useHomeRadiusPreference();
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle('/(tabs)');

  const visibleEvents = useMemo(() => {
    if (!location) {
      return events;
    }

    const selectedCity = normalizeCity(location.city);

    return events.filter((event) => {
      if (
        Number.isFinite(event.latitude) &&
        Number.isFinite(event.longitude) &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude)
      ) {
        return (
          calculateDistanceKm(
            location.latitude,
            location.longitude,
            event.latitude!,
            event.longitude!,
          ) <= radiusKm
        );
      }

      if (selectedCity) {
        return normalizeCity(event.city) === selectedCity;
      }

      return true;
    });
  }, [events, location, radiusKm]);

  if (visibleEvents.length === 0) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          title={location ? 'Keine Events in diesem Umkreis' : 'Keine Events vorhanden'}
          description={
            location
              ? 'Wähle einen größeren Umkreis oder einen anderen Standort.'
              : 'Veröffentlichte Events erscheinen hier, sobald sie im Event-Core verfügbar sind.'
          }
        />
      </View>
    );
  }

  return (
    <FlatList
      data={visibleEvents}
      keyExtractor={(event) => event.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <EventDiscoveryCard
          event={item}
          variant="featuredHome"
          saved={isHydrated && isFavorite(item.id)}
          onFavoritePress={() => toggleFavorite(item.id)}
          testID={`home-event-${item.id}`}
        />
      )}
      ListHeaderComponent={<View style={styles.listHeaderSpacer} />}
      testID="home-event-list"
    />
  );
}

const styles = StyleSheet.create({
  stateWrap: {
    flex: 1,
    paddingHorizontal: spacingRoles.screenHorizontal,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacingRoles.sectionGap,
    paddingBottom: spacingRoles.listBottomInset,
  },
  listHeaderSpacer: {
    height: 4,
  },
});
