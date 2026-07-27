import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import {
  LocationDisabledState,
  LocationPermissionState,
  MapEmptyState,
} from '@/components/map/MapLocationStates';
import {
  CitySelector,
  DistanceChip,
  DiscoveryGridMapToggle,
  MapFilterButton,
  RecenterButton,
} from '@/components/map/MapControls';
import { Skeleton } from '@/components/feedback/Skeleton';
import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { FEATURED_EVENT_IDS } from '@/features/events';
import { useFavoriteToggle } from '@/features/favorites';
import { LocationPickerModal } from '@/features/location/components/LocationPickerModal';
import { getManualDiscoveryCityOptions } from '@/features/location/discovery-city-options';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { MAP_RADIUS_OPTIONS } from '@/features/map/config/map-discovery-config';
import { SearchInput } from '@/features/search/components/SearchInput';
import { useSearchFilters } from '@/features/search/SearchContext';
import { countActiveFilters } from '@/features/search/utils/filter-events';
import { useScreenBottomInset } from '@/platform/screen-insets';

import { MapClubPreviewBottomSheet } from './MapClubPreviewBottomSheet';
import { MapDiscoverySurface } from './MapDiscoverySurface';
import { MapEventPreviewBottomSheet } from './MapEventPreviewBottomSheet';
import { MapFilterSheet } from './MapFilterSheet';
import { useMapDiscoveryController } from '../hooks/useMapDiscoveryController';

export type MapDiscoveryPresentationOverride =
  | 'default'
  | 'loading'
  | 'empty'
  | 'permission'
  | 'location_disabled';

export interface MapDiscoveryScreenProps {
  variant?: 'embedded' | 'standalone';
  onSwitchToList?: () => void;
  onSwitchToGrid?: () => void;
  presentationOverride?: MapDiscoveryPresentationOverride;
}

export function MapDiscoveryScreen({
  variant = 'standalone',
  onSwitchToList,
  onSwitchToGrid,
  presentationOverride = 'default',
}: MapDiscoveryScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = useScreenBottomInset();
  const { filters, setQuery, applyFilters } = useSearchFilters();
  const {
    displayLabel,
    loading,
    errorCode,
    location,
    selectDiscoveryCity,
    requestCurrentLocation,
  } = useUserLocation();
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle('/(tabs)/map');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const discoveryCities = getManualDiscoveryCityOptions();

  const {
    mapFilter,
    layer,
    viewport,
    mapEvents,
    mapClubs,
    selection,
    selectedEvent,
    selectedClub,
    mapMoved,
    presentationState,
    locationPresentation,
    recenterState,
    handleSelectMarker,
    handleClearSelection,
    handlePanMap,
    handleRecenter,
    handleSearchInArea,
    handleApplyMapFilter,
    handleCycleLayer,
  } = useMapDiscoveryController({
    filters,
    featuredIds: [...FEATURED_EVENT_IDS],
    simulateOffline: presentationOverride === 'default' ? false : false,
  });

  const activeFilterCount = countActiveFilters(filters) + (mapFilter.radiusKm === 25 ? 0 : 1);

  const radiusLabel = useMemo(
    () => MAP_RADIUS_OPTIONS.find((option) => option.id === mapFilter.radiusKm)?.label ?? '25 km',
    [mapFilter.radiusKm],
  );

  const resolvedPresentation =
    presentationOverride === 'default' ? presentationState : presentationOverride;

  const content = useMemo(() => {
    if (resolvedPresentation === 'loading') {
      return <Skeleton shape="card" height={420} testID="map-loading-state" />;
    }

    if (resolvedPresentation === 'permission') {
      return (
        <LocationPermissionState
          primaryAction={
            <PrimaryButton label="Standort aktivieren" onPress={() => void requestCurrentLocation()} />
          }
          secondaryAction={
            <SecondaryButton label="Erneut versuchen" onPress={() => void requestCurrentLocation()} />
          }
        />
      );
    }

    if (resolvedPresentation === 'location_disabled') {
      return (
        <LocationDisabledState
          primaryAction={
            <PrimaryButton label="Standort aktivieren" onPress={() => void requestCurrentLocation()} />
          }
        />
      );
    }

    if (resolvedPresentation === 'empty') {
      return (
        <MapEmptyState
          primaryAction={<SecondaryButton label="Filter anpassen" onPress={() => setFilterSheetVisible(true)} />}
        />
      );
    }

    if (!viewport) {
      return <Skeleton shape="card" height={420} testID="map-loading-state" />;
    }

    return (
      <MapDiscoverySurface
        viewport={viewport}
        events={mapEvents}
        clubs={mapClubs}
        layer={layer}
        selection={selection}
        onSelectMarker={handleSelectMarker}
        onPanMap={handlePanMap}
        onClearSelection={handleClearSelection}
      />
    );
  }, [
    handleClearSelection,
    handlePanMap,
    handleSelectMarker,
    layer,
    mapClubs,
    mapEvents,
    requestCurrentLocation,
    resolvedPresentation,
    selection,
    viewport,
  ]);

  return (
    <View testID="map-discovery-screen" style={[styles.container, { paddingBottom: bottomInset }]}>
      <View style={[styles.header, { paddingTop: variant === 'standalone' ? insets.top + spacing.sm : 0 }]}>
        {variant === 'standalone' ? (
          <AppText role="titleLarge" style={styles.title}>
            Karte
          </AppText>
        ) : null}
        {variant === 'standalone' ? (
          <SearchInput value={filters.query} onChangeText={setQuery} />
        ) : null}
        <View style={styles.controlRow}>
          <CitySelector cityLabel={displayLabel} selected onPress={() => setLocationPickerVisible(true)} />
          <DistanceChip label={radiusLabel} selected onPress={() => setFilterSheetVisible(true)} />
          <MapFilterButton
            active={activeFilterCount > 0}
            count={activeFilterCount}
            onPress={() => setFilterSheetVisible(true)}
          />
          <RecenterButton state={recenterState} onPress={() => void handleRecenter()} />
          {variant === 'standalone' ? (
            <DiscoveryGridMapToggle
              value="map"
              onChange={(next) => {
                if (next === 'grid') {
                  (onSwitchToGrid ?? onSwitchToList)?.();
                }
              }}
            />
          ) : null}
        </View>
        {locationPresentation === 'denied' && resolvedPresentation === 'ready' ? (
          <AppText role="caption">Standort verweigert — Karte nutzt den gewählten Entdeckungsort.</AppText>
        ) : null}
        {locationPresentation === 'unknown' && resolvedPresentation === 'ready' ? (
          <AppText role="caption">Standort unbekannt — wähle einen Ort oder aktiviere den Standort.</AppText>
        ) : null}
      </View>

      <View style={styles.mapArea}>{content}</View>

      {mapMoved && resolvedPresentation === 'ready' ? (
        <View style={styles.searchAreaWrap} testID="map-search-in-area">
          <PrimaryButton label="In diesem Bereich suchen" onPress={handleSearchInArea} />
        </View>
      ) : null}

      <MapEventPreviewBottomSheet
        visible={Boolean(selectedEvent)}
        event={selectedEvent}
        isFavorite={Boolean(selectedEvent && isHydrated && isFavorite(selectedEvent.id))}
        onToggleFavorite={() => {
          if (selectedEvent) {
            toggleFavorite(selectedEvent.id);
          }
        }}
        onClose={handleClearSelection}
      />

      <MapClubPreviewBottomSheet
        visible={Boolean(selectedClub)}
        club={selectedClub}
        onClose={handleClearSelection}
      />

      <MapFilterSheet
        visible={filterSheetVisible}
        eventFilters={filters}
        mapFilter={mapFilter}
        onClose={() => setFilterSheetVisible(false)}
        onApply={(nextEventFilters, nextMapFilter) => {
          applyFilters(nextEventFilters);
          handleApplyMapFilter(nextMapFilter);
          setFilterSheetVisible(false);
        }}
      />

      <LocationPickerModal
        visible={locationPickerVisible}
        loading={loading}
        errorCode={errorCode}
        discoveryCities={discoveryCities}
        selectedDiscoveryCityId={location?.discoveryCityId}
        onClose={() => setLocationPickerVisible(false)}
        onUseCurrentLocation={() => {
          void requestCurrentLocation().then((success) => {
            if (success) {
              setLocationPickerVisible(false);
            }
          });
        }}
        onSelectDiscoveryCity={(city) => {
          void selectDiscoveryCity(city).then((success) => {
            if (success) {
              setLocationPickerVisible(false);
            }
          });
        }}
      />

      <SecondaryButton label="Kartenebene" onPress={handleCycleLayer} style={styles.layerButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.sm,
  },
  title: {
    paddingTop: spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapArea: {
    flex: 1,
    marginHorizontal: spacingRoles.screenHorizontal,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 320,
  },
  searchAreaWrap: {
    position: 'absolute',
    left: spacingRoles.screenHorizontal,
    right: spacingRoles.screenHorizontal,
    bottom: spacing.xl,
  },
  layerButton: {
    position: 'absolute',
    right: spacingRoles.screenHorizontal,
    bottom: spacing.xxl,
    alignSelf: 'flex-end',
    opacity: 0.92,
  },
});
