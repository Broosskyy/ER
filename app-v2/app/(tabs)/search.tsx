import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocalSearchParams } from 'expo-router';

import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  ListRenderItem,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { EmptyState } from '@/components/feedback/EmptyState';
import { DiscoveryGridMapToggle } from '@/components/map/MapControls';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { EventDiscoveryCard, type EventDisplayModel } from '@/features/events';
import { useFavoriteToggle } from '@/features/favorites';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { MapDiscoveryScreen } from '@/features/map/components/MapDiscoveryScreen';
import {
  EventDiscoveryGrid,
  FilterSheet,
  FilterSummaryBar,
  QuickFilterRow,
  SearchEmptyState,
  SearchExplorePanel,
  SearchInput,
  type SearchInputHandle,
  SearchResultsMeta,
} from '@/features/search';
import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/features/search/constants';
import { useUniversalSearch } from '@/features/search/hooks/use-universal-search';
import { UniversalSearchResults } from '@/features/search/components/UniversalSearchResults';
import type { SearchEntityTab } from '@/features/search/domain/location-scope';
import { useSearchSuggestions } from '@/features/search/hooks/use-search-suggestions';
import { useSearchFilters } from '@/features/search/SearchContext';
import {
  countActiveFilters,
  getActiveFilterSummaries,
  hasDiscoverySearchQuery,
} from '@/features/search/utils/filter-events';
import { useScreenBottomInset } from '@/platform/screen-insets';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

type DiscoveryView = 'grid' | 'map';

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
    <EventDiscoveryCard
      event={event}
      variant="compactPremium"
      saved={isFavorite}
      onFavoritePress={() => onToggleFavorite(event.id)}
    />
  );
});

export default function SearchScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.search);
  const params = useLocalSearchParams<{ view?: string }>();
  const { t } = useAppTranslation();
  const [discoveryView, setDiscoveryView] = useState<DiscoveryView>(
    () => (params.view === 'map' ? 'map' : 'grid'),
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle('/(tabs)/search');
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
  const searchInputRef = useRef<SearchInputHandle>(null);

  const activeFilterCount = countActiveFilters(filters);
  const hasTextQuery = hasDiscoverySearchQuery(filters);
  const filterSummaries = getActiveFilterSummaries(filters);
  const showExplorePanel = isSearchFocused && !hasTextQuery && activeFilterCount === 0;
  const showTextResults = hasTextQuery;

  const {
    events,
    visibleEvents,
    grouped,
    loading,
    loadingGrouped,
    refreshing,
    loadingMore,
    error,
    hasMore,
    totalMatched,
    isOnline,
    refresh,
    loadMore,
    retry,
  } = useUniversalSearch(filters, { enabled: !showExplorePanel });

  const { suggestions, loading: suggestionsLoading } = useSearchSuggestions(
    filters.query,
    isSearchFocused && filters.query.trim().length >= 2,
  );

  const gridResetKey = useMemo(
    () =>
      JSON.stringify({
        ...filters,
        query: undefined,
      }),
    [filters],
  );

  useEffect(() => {
    if (!shouldAutoFocus) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      clearSearchFocus();
    });

    return () => cancelAnimationFrame(frame);
  }, [shouldAutoFocus, clearSearchFocus]);

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

  const bottomInset = useScreenBottomInset();

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

  const handleEntityTabChange = useCallback(
    (entityTab: SearchEntityTab) => {
      applyFilters({ ...filters, entityTab });
    },
    [applyFilters, filters],
  );

  const displayEvents = showTextResults ? visibleEvents : events;

  const handleSelectQuery = useCallback(
    (query: string) => {
      setQuery(query);
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    },
    [setQuery],
  );

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.header}>
            <AppText role="titleLarge" style={styles.title}>
              {t('search.title')}
            </AppText>
            <SearchInput
              ref={searchInputRef}
              value={filters.query}
              onChangeText={setQuery}
              autoFocus={shouldAutoFocus}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            <View style={styles.toolbarRow}>
              <View style={styles.filterArea}>
                <QuickFilterRow
                  dateRange={filters.dateRange}
                  activeFilterCount={activeFilterCount}
                  onSelectDateRange={handleQuickDateSelect}
                  onOpenFilters={() => setFilterSheetVisible(true)}
                />
              </View>
              <DiscoveryGridMapToggle value={discoveryView} onChange={setDiscoveryView} />
            </View>
            <FilterSummaryBar
              summaries={filterSummaries}
              onClearAll={activeFilterCount > 0 ? clearFilters : undefined}
            />
          </View>

          {discoveryView === 'map' ? (
            <MapDiscoveryScreen
              variant="embedded"
              onSwitchToGrid={() => setDiscoveryView('grid')}
            />
          ) : showExplorePanel ? (
            <SearchExplorePanel
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              onSelectQuery={handleSelectQuery}
              bottomInset={bottomInset}
            />
          ) : error ? (
            <View style={[styles.stateWrap, { paddingBottom: bottomInset }]}>
              <EmptyState
                title={isOnline ? 'Suche fehlgeschlagen' : 'Offline'}
                description={
                  isOnline
                    ? error
                    : 'Keine Internetverbindung. Bitte versuche es erneut.'
                }
                primaryAction={<PrimaryButton label="Erneut versuchen" onPress={() => void retry()} />}
              />
            </View>
          ) : showTextResults ? (
            loading && displayEvents.length === 0 ? (
              <View style={[styles.stateWrap, { paddingBottom: bottomInset }]}>
                <ActivityIndicator />
              </View>
            ) : displayEvents.length === 0 && !grouped ? (
              <SearchEmptyState
                onClearAll={clearFilters}
                onAdjustFilters={() => setFilterSheetVisible(true)}
              />
            ) : (
              <FlatList
                style={styles.list}
                data={showTextResults && grouped ? [] : displayEvents}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
                onEndReached={() => void loadMore()}
                onEndReachedThreshold={0.4}
                ListHeaderComponent={
                  <>
                    <SearchResultsMeta
                      count={totalMatched || displayEvents.length}
                      summary={filterSummaries.length > 0 ? filterSummaries.join(' · ') : undefined}
                      onClear={activeFilterCount > 0 ? clearFilters : undefined}
                    />
                    {grouped ? (
                      <UniversalSearchResults
                        grouped={grouped}
                        entityTab={filters.entityTab}
                        onEntityTabChange={handleEntityTabChange}
                        events={displayEvents}
                        isFavorite={(eventId) => isHydrated && isFavorite(eventId)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ) : null}
                    {loadingGrouped ? <ActivityIndicator /> : null}
                  </>
                }
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.footerLoader}>
                      <ActivityIndicator />
                    </View>
                  ) : null
                }
                contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
              />
            )
          ) : (
            <EventDiscoveryGrid
              events={events}
              loading={loading}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              isFavorite={(eventId: string) => isHydrated && isFavorite(eventId)}
              onToggleFavorite={toggleFavorite}
              isHydrated={isHydrated}
              onClearFilters={clearFilters}
              onAdjustFilters={() => setFilterSheetVisible(true)}
              onSwitchToMap={() => setDiscoveryView('map')}
              bottomInset={bottomInset}
              resetKey={gridResetKey}
            />
          )}

          <FilterSheet
            visible={filterSheetVisible}
            appliedFilters={filters}
            mode="full"
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
  header: {
    gap: 0,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacingRoles.screenHorizontal,
  },
  filterArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
