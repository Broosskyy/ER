import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/discovery/FilterChip';
import { FilterBottomSheet } from '@/components/search/FilterBottomSheet';
import {
  DistanceFilter,
  GenreFilter,
  PriceFilter,
} from '@/components/search/FilterSections';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import {
  getActiveDateOptions,
  getActiveGenreOptions,
} from '@/features/search/config/filter-config';
import type { GenreFilterId } from '@/features/search/config/filter-config.types';
import type { EventFilters } from '@/features/search/constants';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';

import { MAP_RADIUS_OPTIONS, MAP_SORT_OPTIONS } from '../config/map-discovery-config';
import { DEFAULT_MAP_FILTER, type MapFilter } from '../types/discovery-models';

export interface MapFilterSheetProps {
  visible: boolean;
  eventFilters: EventFilters;
  mapFilter: MapFilter;
  onClose: () => void;
  onApply: (eventFilters: EventFilters, mapFilter: MapFilter) => void;
}

export function MapFilterSheet({
  visible,
  eventFilters,
  mapFilter,
  onClose,
  onApply,
}: MapFilterSheetProps) {
  const draftKey = visible
    ? JSON.stringify({ eventFilters, mapFilter })
    : 'closed';

  return (
    <MapFilterSheetContent
      key={draftKey}
      visible={visible}
      eventFilters={eventFilters}
      mapFilter={mapFilter}
      onClose={onClose}
      onApply={onApply}
    />
  );
}

function MapFilterSheetContent({
  visible,
  eventFilters,
  mapFilter,
  onClose,
  onApply,
}: MapFilterSheetProps) {
  const [draftEvents, setDraftEvents] = useState(eventFilters);
  const [draftMap, setDraftMap] = useState(mapFilter);

  const genreOptions = getActiveGenreOptions().map((option) => ({
    id: option.id,
    label: option.label,
    selected: draftEvents.genres.includes(option.id),
  }));

  const dateOptions = getActiveDateOptions();

  const distanceOptions = MAP_RADIUS_OPTIONS.map((option) => ({
    id: String(option.id),
    label: option.label,
    selected: draftMap.radiusKm === option.id,
  }));

  const priceOptions = [
    { id: 'all', label: 'Alle', selected: !draftMap.freeOnly },
    { id: 'free', label: 'Kostenlos', selected: draftMap.freeOnly },
  ];

  return (
    <FilterBottomSheet
      visible={visible}
      title="Kartenfilter"
      onClose={onClose}
      onReset={() => {
        setDraftEvents(DEFAULT_EVENT_FILTERS);
        setDraftMap(DEFAULT_MAP_FILTER);
      }}
      onApply={() => onApply(draftEvents, draftMap)}
      testID="map-filter-sheet"
    >
      <DistanceFilter
        options={distanceOptions}
        onSelect={(id) => {
          const radius = MAP_RADIUS_OPTIONS.find((option) => String(option.id) === id)?.id ?? 25;
          setDraftMap((current) => ({ ...current, radiusKm: radius }));
        }}
      />
      <View style={styles.section}>
        <AppText role="label">Datum</AppText>
        <View style={styles.chipWrap}>
          {dateOptions.map((option) => (
            <FilterChip
              key={option.id}
              label={option.label}
              selected={draftEvents.dateRange === option.id}
              onPress={() => setDraftEvents((current) => ({ ...current, dateRange: option.id }))}
            />
          ))}
        </View>
      </View>
      <GenreFilter
        options={genreOptions}
        onToggle={(id) =>
          setDraftEvents((current) => {
            const genreId = id as GenreFilterId;
            return {
              ...current,
              genres: current.genres.includes(genreId)
                ? current.genres.filter((genre) => genre !== genreId)
                : [...current.genres, genreId],
            };
          })
        }
      />
      <PriceFilter
        options={priceOptions}
        onToggle={(id) => setDraftMap((current) => ({ ...current, freeOnly: id === 'free' }))}
      />
      <View style={styles.section}>
        <AppText role="label">Ortstyp</AppText>
        <View style={styles.chipWrap}>
          <FilterChip
            label="Indoor"
            selected={draftMap.indoor}
            onPress={() => setDraftMap((current) => ({ ...current, indoor: !current.indoor }))}
          />
          <FilterChip
            label="Outdoor"
            selected={draftMap.outdoor}
            onPress={() => setDraftMap((current) => ({ ...current, outdoor: !current.outdoor }))}
          />
        </View>
      </View>
      <View style={styles.section}>
        <AppText role="label">Sortierung</AppText>
        <View style={styles.chipWrap}>
          {MAP_SORT_OPTIONS.map((option) => (
            <FilterChip
              key={option.id}
              label={option.label}
              selected={draftMap.sortBy === option.id}
              onPress={() => setDraftMap((current) => ({ ...current, sortBy: option.id }))}
            />
          ))}
        </View>
      </View>
    </FilterBottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
