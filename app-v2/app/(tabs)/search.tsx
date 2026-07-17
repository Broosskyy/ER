import { memo, useCallback, useMemo, useState } from 'react';
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
  DEFAULT_SEARCH_FILTERS,
  SearchEmptyState,
  SearchGenreChipRow,
  SearchInput,
  SearchGenreChipId,
  SearchSortOption,
  SortSegmentControl,
  filterSearchEvents,
} from '@/features/search';

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
  const { isFavorite, toggleFavorite } = useFavorites();
  const [query, setQuery] = useState(DEFAULT_SEARCH_FILTERS.query);
  const [genreId, setGenreId] = useState<SearchGenreChipId>(DEFAULT_SEARCH_FILTERS.genreId);
  const [sort, setSort] = useState<SearchSortOption>(DEFAULT_SEARCH_FILTERS.sort);

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

  const handleClearFilters = useCallback(() => {
    setQuery(DEFAULT_SEARCH_FILTERS.query);
    setGenreId(DEFAULT_SEARCH_FILTERS.genreId);
    setSort(DEFAULT_SEARCH_FILTERS.sort);
  }, []);

  const renderItem: ListRenderItem<EventDisplayModel> = useCallback(
    ({ item }) => (
      <SearchEventRow
        event={item}
        isFavorite={isFavorite(item.id)}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [isFavorite, toggleFavorite],
  );

  const keyExtractor = useCallback((item: EventDisplayModel) => item.id, []);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <AppText variant="title">Search</AppText>
        </View>

        <SearchInput value={query} onChangeText={setQuery} />

        <SearchGenreChipRow selectedId={genreId} onSelect={setGenreId} />

        <SortSegmentControl selected={sort} onSelect={setSort} />

        {results.length === 0 ? (
          <SearchEmptyState onClearFilters={handleClearFilters} />
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
