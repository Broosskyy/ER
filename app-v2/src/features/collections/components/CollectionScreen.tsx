import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  ListRenderItem,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { spacingRoles } from '@/design/spacing';
import { CollectionHeader } from '@/features/collections/components/CollectionHeader';
import { getCollectionConfig, type CollectionType } from '@/features/collections/event-collections';
import { EventDiscoveryCard, type EventDisplayModel } from '@/features/events';
import { useFavoriteToggle } from '@/features/favorites';
import { useDiscoveryCollectionFeed } from '@/features/home/hooks/use-discovery-collection-feed';
import { filterDisplayEvents } from '@/features/home/utils/filter-display-events';
import { FilterSheet } from '@/features/search/components/FilterSheet';
import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/features/search/constants';
import { countActiveFilters } from '@/features/search/utils/filter-events';
import { useScreenBottomInset } from '@/platform/screen-insets';

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
    <EventDiscoveryCard
      event={event}
      variant="compactPremium"
      saved={isFavorite}
      onFavoritePress={() => onToggleFavorite(event.id)}
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
  const config = getCollectionConfig(type);
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle();
  const [filters, setFilters] = useState<EventFilters>(createCollectionFilters);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const {
    events: discoveryEvents,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    isOnline,
    refresh,
    loadMore,
    retry,
  } = useDiscoveryCollectionFeed(type);

  const bottomInset = useScreenBottomInset();

  const filteredEvents = useMemo(() => {
    return filterDisplayEvents(discoveryEvents, filters);
  }, [discoveryEvents, filters]);

  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    if (!filterSheetVisible || Platform.OS !== 'android') {
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

  const listFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator />
    </View>
  ) : null;

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <CollectionHeader
            title={config.title}
            subtitle={config.subtitle}
            count={filteredEvents.length}
            showFilter
            onFilterPress={() => setFilterSheetVisible(true)}
          />

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator />
            </View>
          ) : error ? (
            <EmptyState
              title={config.emptyTitle}
              description={!isOnline ? 'Offline — bitte Verbindung prüfen.' : error}
              primaryAction={<PrimaryButton label="Erneut versuchen" onPress={() => void retry()} />}
            />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              title={config.emptyTitle}
              description={config.emptyDescription}
              action={
                activeFilterCount > 0 ? (
                  <PrimaryButton label="Reset filters" onPress={handleResetFilters} />
                ) : (
                  <PrimaryButton label="Aktualisieren" onPress={() => void refresh()} />
                )
              }
            />
          ) : (
            <FlatList
              style={styles.list}
              data={filteredEvents}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
              onEndReached={() => {
                if (hasMore && activeFilterCount === 0) {
                  void loadMore();
                }
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={listFooter}
              contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
            />
          )}

          <FilterSheet
            visible={filterSheetVisible}
            appliedFilters={filters}
            mode="collection"
            onClose={() => setFilterSheetVisible(false)}
            onApply={handleApplyFilters}
          />
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: spacingRoles.sectionGap,
    alignItems: 'center',
  },
});
