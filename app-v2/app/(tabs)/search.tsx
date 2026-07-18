import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  QuickFilterRow,
  SearchEmptyState,
  SearchInput,
  SearchResultsMeta,
} from '@/features/search';
import { useSearchFilters } from '@/features/search/SearchContext';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import {
  applyEventFilters,
  countActiveFilters,
  summarizeActiveFilters,
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
  const [genreSheetVisible, setGenreSheetVisible] = useState(false);

  const isSearchActive = filters.query.trim().length > 0;
  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    if (!shouldAutoFocus) {
      return;
    }

    const timeout = setTimeout(() => {
      clearSearchFocus();
    }, 300);

    return () => clearTimeout(timeout);
  }, [shouldAutoFocus, clearSearchFocus]);

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

  const handleOpenGenreSheet = useCallback(() => {
    setGenreSheetVisible(true);
  }, []);

  const filterSummary = summarizeActiveFilters(filters);

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
              onSelectDateRange={setDateRange}
              onOpenGenre={handleOpenGenreSheet}
              onOpenFilters={() => setFilterSheetVisible(true)}
            />
          </View>
        </TouchableWithoutFeedback>

        {isSearchActive || activeFilterCount > 0 ? (
          results.length === 0 ? (
            <SearchEmptyState onClearFilters={clearFilters} />
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
                  summary={filterSummary || undefined}
                  onClear={activeFilterCount > 0 ? clearFilters : undefined}
                />
              }
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
              ]}
            />
          )
        ) : (
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
            renderItem={() => (
              <ExploreFeed dateRange={filters.dateRange} genreId={filters.genreId} />
            )}
          />
        )}

        <FilterSheet
          visible={filterSheetVisible}
          initialFilters={filters}
          mode="full"
          availableCities={[...new Set(eventRepository.getPublishedEvents().map((event) => event.city))]}
          onClose={() => setFilterSheetVisible(false)}
          onApply={(next) => {
            applyFilters(next);
            setFilterSheetVisible(false);
          }}
          onReset={() => {
            clearFilters();
            setFilterSheetVisible(false);
          }}
        />

        <FilterSheet
          visible={genreSheetVisible}
          initialFilters={filters}
          mode="collection"
          availableCities={[...new Set(eventRepository.getPublishedEvents().map((event) => event.city))]}
          onClose={() => setGenreSheetVisible(false)}
          onApply={(next) => {
            applyFilters({ ...filters, genreId: next.genreId, sortBy: next.sortBy, city: next.city });
            setGenreSheetVisible(false);
          }}
          onReset={() => {
            applyFilters({ ...filters, genreId: DEFAULT_EVENT_FILTERS.genreId });
            setGenreSheetVisible(false);
          }}
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
