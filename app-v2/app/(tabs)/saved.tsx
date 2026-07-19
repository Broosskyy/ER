import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, ListRenderItem, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen, SafeAreaContainer } from '@/components';
import { spacingRoles } from '@/design/spacing';
import type { EventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import { SavedEmptyState, SavedEventRow, SavedHeader } from '@/features/saved';
import { getBottomTabBarHeight } from '@/platform/tab-bar-insets';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteEvents, isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const tabBarHeight = getBottomTabBarHeight(insets);

  const handleExploreEvents = useCallback(() => {
    router.navigate('/(tabs)');
  }, [router]);

  const renderItem: ListRenderItem<EventDisplayModel> = useCallback(
    ({ item }) => (
      <SavedEventRow
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
        <SavedHeader count={isHydrated ? favoriteEvents.length : 0} />

        {!isHydrated ? (
          <View style={[styles.emptyWrap, { paddingBottom: tabBarHeight }]} />
        ) : favoriteEvents.length === 0 ? (
          <View style={[styles.emptyWrap, { paddingBottom: tabBarHeight }]}>
            <SavedEmptyState onExploreEvents={handleExploreEvents} />
          </View>
        ) : (
          <FlatList
            data={favoriteEvents}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
            ]}
            extraData={favoriteEvents.length}
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
  emptyWrap: {
    flex: 1,
  },
  listContent: {
    flexGrow: 0,
  },
});
