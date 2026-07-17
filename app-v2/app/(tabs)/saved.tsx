import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, ListRenderItem, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen, SafeAreaContainer } from '@/components';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import type { EventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import { SavedEmptyState, SavedEventRow, SavedHeader } from '@/features/saved';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteEvents, isFavorite, toggleFavorite } = useFavorites();
  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);

  const handleExploreEvents = useCallback(() => {
    router.navigate('/(tabs)');
  }, [router]);

  const renderItem: ListRenderItem<EventDisplayModel> = useCallback(
    ({ item }) => (
      <SavedEventRow
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
        <SavedHeader count={favoriteEvents.length} />

        {favoriteEvents.length === 0 ? (
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
