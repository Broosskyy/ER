import { memo, useCallback, useEffect, useMemo } from 'react';
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
  ExploreTimeFilterRow,
  SearchEmptyState,
  SearchGenreChipRow,
  SearchInput,
  filterSearchEvents,
} from '@/features/search';
import { useSearchFilters } from '@/features/search/SearchContext';

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
    query,
    timeFilter,
    genreId,
    setQuery,
    setTimeFilter,
    setGenreId,
    clearFilters,
    shouldAutoFocus,
    clearSearchFocus,
  } = useSearchFilters();

  const isSearchActive = query.trim().length > 0;

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
    const filtered = filterSearchEvents(
      eventRepository.getPublishedEvents(),
      query,
      genreId,
      timeFilter,
    );
    return filtered.map(toEventDisplayModel);
  }, [query, genreId, timeFilter]);

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

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.filters}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              autoFocus={shouldAutoFocus}
            />

            <ExploreTimeFilterRow selectedId={timeFilter} onSelect={setTimeFilter} />
            <SearchGenreChipRow selectedId={genreId} onSelect={setGenreId} />
          </View>
        </TouchableWithoutFeedback>

        {isSearchActive ? (
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
            renderItem={() => <ExploreFeed timeFilter={timeFilter} genreId={genreId} />}
          />
        )}
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
