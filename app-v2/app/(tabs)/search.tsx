import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  ListRenderItem,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen, SafeAreaContainer } from '@/components';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import {
  eventRepository,
  toEventDisplayModel,
  type EventDisplayModel,
} from '@/features/events';
import { useFavorites } from '@/features/favorites';
import { EventCard } from '@/features/home/components';
import {
  ExploreFeed,
  FilterSheet,
  FilterSummaryBar,
  QuickFilterRow,
  SearchEmptyState,
  SearchInput,
  SearchResultsMeta,
} from '@/features/search';
import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/features/search/constants';
import { useSearchFilters } from '@/features/search/SearchContext';
import {
  applyEventFilters,
  countActiveFilters,
  getActiveFilterSummaries,
  isExploreMode,
} from '@/features/search/utils/filter-events';

interface SearchEventRowProps {
  event: EventDisplayModel;
  isFavorite: boolean;
  onToggleFavorite: (eventId: string) => void;
}

const SearchEventRow = memo(function SearchEventRow({
  event,
  isFavorite,
  onToggleFavorite,
}: SearchEventRowProps) {
  return (
    <EventCard
      event={event}
      isFavorite={isFavorite}
      onToggleFavorite={() => onToggleFavorite(event.id)}
    />
  );
});

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const {
    filters,
    setQuery,
    setDateRange,
    applyFilters,
    clearFilters,
    shouldAutoFocus,
    clearSearchFocus,
  } = useSearchFilters();
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const activeFilterCount = countActiveFilters(filters);
  const showExplore = isExploreMode(filters);
  const filterSummaries = getActiveFilterSummaries(filters);

  useEffect(() => {
    if (!shouldAutoFocus) {
      return;
    }

    const timeout = setTimeout(() => {
      clearSearchFocus();
    }, 300);

    return () => clearTimeout(timeout);
  }, [shouldAutoFocus, clearSearchFocus]);

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

  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);

  const results = useMemo(() => {
    return applyEventFilters(eventRepository.getPublishedEvents(), filters).map(toEventDisplayModel);
  }, [filters]);

  const renderItem: ListRenderItem<EventDisplayModel> = useCallback(
    ({ item }) => (
      <SearchEventRow
        event={item}
        isFavorite={isHydrated && isFavorite(item.id)}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [isFavorite, isHydrated, toggleFavorite],
  );

  const keyExtractor = useCallback((item: EventDisplayModel) => item.id, []);

  const handleQuickDateSelect = useCallback(
    (dateRange: typeof filters.dateRange) => {
      const isAlreadySelected = filters.dateRange === dateRange;
      setDateRange(isAlreadySelected ? DEFAULT_EVENT_FILTERS.dateRange : dateRange);
    },
    [filters.dateRange, setDateRange],
  );

  const handleApplyFilters = useCallback(
    (next: EventFilters) => {
      applyFilters(next);
    },
    [applyFilters],
  );

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.filters}>
            <SearchInput
              value={filters.query}
              onChangeText={setQuery}
              autoFocus={shouldAutoFocus}
            />
            <QuickFilterRow
              dateRange={filters.dateRange}
              activeFilterCount={activeFilterCount}
              onSelectDateRange={handleQuickDateSelect}
              onOpenFilters={() => setFilterSheetVisible(true)}
            />
            <FilterSummaryBar
              summaries={filterSummaries}
              onClearAll={activeFilterCount > 0 ? clearFilters : undefined}
            />
          </View>
        </TouchableWithoutFeedback>

        {showExplore ? (
          <FlatList
            data={[{ key: 'explore' }]}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
            ]}
            renderItem={() => <ExploreFeed />}
          />
        ) : results.length === 0 ? (
          <SearchEmptyState
            onClearAll={clearFilters}
            onAdjustFilters={() => setFilterSheetVisible(true)}
          />
        ) : (
          <FlatList
            data={results}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            ListHeaderComponent={
              <SearchResultsMeta
                count={results.length}
                summary={filterSummaries.length > 0 ? filterSummaries.join(' · ') : undefined}
                onClear={activeFilterCount > 0 ? clearFilters : undefined}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
            ]}
          />
        )}

        <FilterSheet
          visible={filterSheetVisible}
          appliedFilters={filters}
          mode="full"
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
  filters: {
    gap: 0,
  },
  listContent: {
    flexGrow: 0,
  },
});
