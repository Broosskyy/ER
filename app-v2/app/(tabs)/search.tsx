import { memo, useCallback, useEffect, useMemo } from 'react';
import { FlatList, ListRenderItem, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen, AppText, SafeAreaContainer } from '@/components';
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
  SearchEmptyState,
  SearchGenreChipRow,
  SearchInput,
  SortSegmentControl,
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
    genreId,
    sort,
    setQuery,
    setGenreId,
    setSort,
    clearFilters,
    shouldAutoFocus,
    clearSearchFocus,
  } = useSearchFilters();

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
      sort,
    );
    return filtered.map(toEventDisplayModel);
  }, [query, genreId, sort]);

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
        <View style={styles.header}>
          <AppText variant="title">Search</AppText>
        </View>

        <SearchInput
          value={query}
          onChangeText={setQuery}
          autoFocus={shouldAutoFocus}
        />

        <SearchGenreChipRow selectedId={genreId} onSelect={setGenreId} />

        <SortSegmentControl selected={sort} onSelect={setSort} />

        {results.length === 0 ? (
          <SearchEmptyState onClearFilters={clearFilters} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
            ]}
            keyboardShouldPersistTaps="handled"
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
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  listContent: {
    flexGrow: 0,
  },
});
