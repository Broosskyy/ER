import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, ListRenderItem, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppScreen, SafeAreaContainer } from '@/components';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { CollectionHeader } from '@/features/collections/components/CollectionHeader';
import {
  getCollectionConfig,
  getCollectionEvents,
  type CollectionType,
} from '@/features/collections/event-collections';
import { toEventDisplayModel, type EventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import { EventCard } from '@/features/home/components';
import { FilterSheet } from '@/features/search/components/FilterSheet';
import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/features/search/constants';
import {
  applyEventFilters,
  countActiveFilters,
} from '@/features/search/utils/filter-events';

export interface CollectionScreenProps {
  type: CollectionType;
}

const CollectionEventRow = memo(function CollectionEventRow({
  event,
  isFavorite,
  onToggleFavorite,
}: {
  event: EventDisplayModel;
  isFavorite: boolean;
  onToggleFavorite: (eventId: string) => void;
}) {
  return (
    <EventCard
      event={event}
      isFavorite={isFavorite}
      onToggleFavorite={() => onToggleFavorite(event.id)}
    />
  );
});

function createCollectionFilters(): EventFilters {
  return {
    ...DEFAULT_EVENT_FILTERS,
    dateRange: 'all-dates',
  };
}

export function CollectionScreen({ type }: CollectionScreenProps) {
  const insets = useSafeAreaInsets();
  const config = getCollectionConfig(type);
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const [filters, setFilters] = useState<EventFilters>(createCollectionFilters);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);

  const baseEvents = useMemo(() => getCollectionEvents(type), [type]);

  const filteredEvents = useMemo(() => {
    return applyEventFilters(baseEvents, filters, {
      preserveCollectionScope: true,
    }).map(toEventDisplayModel);
  }, [baseEvents, filters]);

  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    if (!filterSheetVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setFilterSheetVisible(false);
      return true;
    });

    return () => subscription.remove();
  }, [filterSheetVisible]);

  const renderItem: ListRenderItem<EventDisplayModel> = useCallback(
    ({ item }) => (
      <CollectionEventRow
        event={item}
        isFavorite={isHydrated && isFavorite(item.id)}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [isFavorite, isHydrated, toggleFavorite],
  );

  const handleApplyFilters = useCallback((next: EventFilters) => {
    setFilters({
      ...next,
      dateRange: 'all-dates',
      query: '',
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(createCollectionFilters());
  }, []);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <CollectionHeader
          title={config.title}
          subtitle={config.subtitle}
          count={filteredEvents.length}
          showFilter
          onFilterPress={() => setFilterSheetVisible(true)}
        />

        {filteredEvents.length === 0 ? (
          <EmptyState
            title={config.emptyTitle}
            description={config.emptyDescription}
            action={
              activeFilterCount > 0 ? (
                <PrimaryButton label="Reset filters" onPress={handleResetFilters} />
              ) : undefined
            }
          />
        ) : (
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
            ]}
          />
        )}

        <FilterSheet
          visible={filterSheetVisible}
          appliedFilters={filters}
          mode="collection"
          onClose={() => setFilterSheetVisible(false)}
          onApply={handleApplyFilters}
        />
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
    flexGrow: 0,
  },
});
