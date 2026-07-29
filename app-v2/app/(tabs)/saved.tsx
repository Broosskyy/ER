import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, ListRenderItem, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { SavedFilterBar } from '@/components/saved/SavedFilterBar';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/ToastProvider';
import type { SavedFilterViewModel } from '@/components/saved/view-models';
import { spacing, spacingRoles } from '@/design/spacing';
import { useFavoriteToggle } from '@/features/favorites';
import {
  SavedEmptyState,
  SavedEventCard,
  SavedHeader,
  type SavedFilterId,
  type SavedEvent,
} from '@/features/saved';
import { countSavedEventsByFilter, filterSavedEvents } from '@/features/saved/utils/saved-filters';
import { useScreenBottomInset } from '@/platform/screen-insets';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

const FILTER_LABELS: Record<SavedFilterId, string> = {
  all: 'Alle',
  upcoming: 'Demnächst',
  past: 'Vergangen',
  cancelled: 'Abgesagt',
};

export default function SavedScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.saved);
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<SavedFilterId>('all');
  const { savedEvents, isFavorite, toggleFavorite, isHydrated } =
    useFavoriteToggle('/(tabs)/saved');

  const filteredEvents = useMemo(
    () => filterSavedEvents(savedEvents, activeFilter),
    [activeFilter, savedEvents],
  );

  const filterCounts = useMemo(() => countSavedEventsByFilter(savedEvents), [savedEvents]);

  const filters = useMemo<SavedFilterViewModel[]>(
    () =>
      (Object.keys(FILTER_LABELS) as SavedFilterId[]).map((id) => ({
        id,
        label: FILTER_LABELS[id],
        selected: activeFilter === id,
        count: filterCounts[id],
      })),
    [activeFilter, filterCounts],
  );

  const handleExploreEvents = useCallback(() => {
    router.navigate('/(tabs)/search');
  }, [router]);

  const handleToggleFavorite = useCallback(
    (eventId: string) => {
      const wasFavorite = isFavorite(eventId);
      toggleFavorite(eventId);

      if (wasFavorite) {
        showToast('Event aus Gespeichert entfernt', { variant: 'success' });
      } else {
        showToast('Event gespeichert', { variant: 'success' });
      }
    },
    [isFavorite, showToast, toggleFavorite],
  );

  const renderItem: ListRenderItem<SavedEvent> = useCallback(
    ({ item }) => (
      <SavedEventCard
        item={item}
        isFavorite={isHydrated && isFavorite(item.eventId)}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [handleToggleFavorite, isFavorite, isHydrated],
  );

  const keyExtractor = useCallback((item: SavedEvent) => item.eventId, []);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <SavedHeader count={isHydrated ? savedEvents.length : 0} />

          {isHydrated && savedEvents.length > 0 ? (
            <SavedFilterBar
              filters={filters}
              onSelect={(id) => setActiveFilter(id)}
              style={styles.filterBar}
              testID="saved-filter-bar"
            />
          ) : null}

          {!isHydrated ? (
            <View style={[styles.stateWrap, { paddingBottom: bottomInset }]}>
              <Skeleton shape="card" height={120} />
              <Skeleton shape="card" height={120} />
            </View>
          ) : savedEvents.length === 0 ? (
            <View style={[styles.stateWrap, { paddingBottom: bottomInset }]}>
              <SavedEmptyState onExploreEvents={handleExploreEvents} />
            </View>
          ) : filteredEvents.length === 0 ? (
            <View style={[styles.stateWrap, { paddingBottom: bottomInset }]}>
              <SavedEmptyState variant="no_filter_results" onExploreEvents={handleExploreEvents} />
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={filteredEvents}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
              extraData={filteredEvents.length}
            />
          )}
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  filterBar: {
    marginBottom: spacing.xs,
  },
  stateWrap: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
