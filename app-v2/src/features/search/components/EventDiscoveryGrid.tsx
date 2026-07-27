import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { EventDiscoveryTile } from '@/components/discovery/EventDiscoveryTile';
import { DISCOVERY_GRID_GAP } from '@/components/discovery/discovery-tile-styles';
import { Skeleton } from '@/components/feedback/Skeleton';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { SearchEmptyState } from '@/features/search/components/SearchEmptyState';
import {
  buildDiscoveryGridRows,
  DISCOVERY_GRID_PAGE_SIZE,
  getNextDiscoveryPageCount,
  paginateDiscoveryEvents,
  type DiscoveryGridRow,
} from '@/features/search/utils/discovery-grid-layout';
import { toEventDiscoveryTileViewModel } from '@/features/search/utils/discovery-tile-view-model';
import { getExploreGridColumns } from '@/platform/responsive-layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface EventDiscoveryGridProps {
  events: EventDisplayModel[];
  isFavorite?: (eventId: string) => boolean;
  onToggleFavorite?: (eventId: string) => void;
  isHydrated?: boolean;
  onClearFilters?: () => void;
  onAdjustFilters?: () => void;
  onSwitchToMap?: () => void;
  bottomInset?: number;
  resetKey?: string;
}

function GridRow({
  row,
  gap,
  isFavorite,
  onToggleFavorite,
  onEventPress,
}: {
  row: DiscoveryGridRow;
  gap: number;
  isFavorite?: (eventId: string) => boolean;
  onToggleFavorite?: (eventId: string) => void;
  onEventPress: (eventId: string) => void;
}) {
  return (
    <View style={[styles.row, { gap, marginBottom: gap }]}>
      {row.tiles.map((tile) => (
        <View key={tile.event.id} style={{ flex: tile.flex }}>
          <EventDiscoveryTile
            event={toEventDiscoveryTileViewModel(tile.event)}
            variant={tile.variant}
            saved={isFavorite?.(tile.event.id)}
            onPress={() => onEventPress(tile.event.id)}
            onFavoritePress={
              onToggleFavorite ? () => onToggleFavorite(tile.event.id) : undefined
            }
          />
        </View>
      ))}
    </View>
  );
}

export function EventDiscoveryGrid(props: EventDiscoveryGridProps) {
  return <EventDiscoveryGridContent key={props.resetKey ?? 'default'} {...props} />;
}

function EventDiscoveryGridContent({
  events,
  isFavorite,
  onToggleFavorite,
  isHydrated = true,
  onClearFilters,
  onAdjustFilters,
  onSwitchToMap,
  bottomInset = 0,
}: EventDiscoveryGridProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const columns = getExploreGridColumns(width);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_GRID_PAGE_SIZE);
  const listRef = useRef<FlatList<DiscoveryGridRow>>(null);

  const visibleEvents = useMemo(
    () => paginateDiscoveryEvents(events, visibleCount),
    [events, visibleCount],
  );

  const rows = useMemo(
    () => buildDiscoveryGridRows(visibleEvents, columns),
    [visibleEvents, columns],
  );

  const hasMore = visibleCount < events.length;

  const handleEventPress = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore) {
      return;
    }

    setVisibleCount((current) => getNextDiscoveryPageCount(current, events.length));
  }, [events.length, hasMore]);

  const renderItem: ListRenderItem<DiscoveryGridRow> = useCallback(
    ({ item }) => (
      <GridRow
        row={item}
        gap={DISCOVERY_GRID_GAP}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onEventPress={handleEventPress}
      />
    ),
    [handleEventPress, isFavorite, onToggleFavorite],
  );

  if (!isHydrated) {
    return (
      <View style={[styles.loadingWrap, { paddingBottom: bottomInset }]}>
        <Skeleton shape="card" height={120} />
        <Skeleton shape="card" height={120} />
        <Skeleton shape="card" height={120} />
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={{ paddingBottom: bottomInset }}>
        <SearchEmptyState
          onClearAll={onClearFilters ?? (() => undefined)}
          onAdjustFilters={onAdjustFilters ?? (() => undefined)}
        />
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset, paddingHorizontal: spacingRoles.screenHorizontal },
      ]}
      ListFooterComponent={
        hasMore ? (
          <View style={styles.footer}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : onSwitchToMap ? (
          <View style={styles.footer} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  loadingWrap: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
