import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocalSearchParams } from 'expo-router';

import {

  BackHandler,

  FlatList,

  Keyboard,

  ListRenderItem,

  Platform,

  StyleSheet,

  View,

} from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';

import { DiscoveryGridMapToggle } from '@/components/map/MapControls';

import { AppText } from '@/components/layout/AppText';

import { spacing, spacingRoles } from '@/design/spacing';

import {

  eventRepository,

  EventDiscoveryCard,

  toEventDisplayModel,

  type EventDisplayModel,

} from '@/features/events';

import { useFavoriteToggle } from '@/features/favorites';

import { useAppTranslation } from '@/features/i18n/useAppTranslation';

import {

  EventDiscoveryGrid,

  FilterSheet,

  FilterSummaryBar,

  QuickFilterRow,

  SearchEmptyState,

  SearchInput,

  type SearchInputHandle,

  SearchResultsMeta,

} from '@/features/search';

import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/features/search/constants';

import { useSearchFilters } from '@/features/search/SearchContext';

import {

  applyEventFilters,

  countActiveFilters,

  getActiveFilterSummaries,

  hasDiscoverySearchQuery,

} from '@/features/search/utils/filter-events';

import { getDiscoveryEvents } from '@/features/search/utils/discovery-events';

import { useScreenBottomInset } from '@/platform/screen-insets';

import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';

import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

import { MapDiscoveryScreen } from '@/features/map/components/MapDiscoveryScreen';



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

  const showDiscoveryGrid = !hasDiscoverySearchQuery(filters);

  const filterSummaries = getActiveFilterSummaries(filters);

  const gridResetKey = useMemo(

    () =>

      JSON.stringify({

        dateRange: filters.dateRange,

        genres: filters.genres,

        city: filters.city,

        sortBy: filters.sortBy,

      }),

    [filters.city, filters.dateRange, filters.genres, filters.sortBy],

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



  const discoveryEvents = useMemo(() => getDiscoveryEvents(filters), [filters]);



  const searchResults = useMemo(() => {

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

          ) : showDiscoveryGrid ? (

            <EventDiscoveryGrid

              events={discoveryEvents}

              isFavorite={(eventId: string) => isHydrated && isFavorite(eventId)}

              onToggleFavorite={toggleFavorite}

              isHydrated={isHydrated}

              onClearFilters={clearFilters}

              onAdjustFilters={() => setFilterSheetVisible(true)}

              onSwitchToMap={() => setDiscoveryView('map')}

              bottomInset={bottomInset}

              resetKey={gridResetKey}

            />

          ) : searchResults.length === 0 ? (

            <SearchEmptyState

              onClearAll={clearFilters}

              onAdjustFilters={() => setFilterSheetVisible(true)}

            />

          ) : (

            <FlatList

              style={styles.list}

              data={searchResults}

              keyExtractor={keyExtractor}

              renderItem={renderItem}

              showsVerticalScrollIndicator={false}

              keyboardShouldPersistTaps="handled"

              onScrollBeginDrag={Keyboard.dismiss}

              ListHeaderComponent={

                <SearchResultsMeta

                  count={searchResults.length}

                  summary={filterSummaries.length > 0 ? filterSummaries.join(' · ') : undefined}

                  onClear={activeFilterCount > 0 ? clearFilters : undefined}

                />

              }

              contentContainerStyle={[

                styles.listContent,

                { paddingBottom: bottomInset },

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

});


