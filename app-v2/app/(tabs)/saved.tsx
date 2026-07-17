import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen, AppText, EmptyState, SafeAreaContainer } from '@/components';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { useFavorites } from '@/features/favorites';
import { EventCard } from '@/features/home/components';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { favoriteEvents, isFavorite, toggleFavorite } = useFavorites();
  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']}>
        <View style={styles.header}>
          <AppText variant="title">Saved</AppText>
        </View>

        {favoriteEvents.length === 0 ? (
          <EmptyState
            title="Noch keine Favoriten"
            description="Tippe auf das Herz bei einem Event, um es hier zu speichern."
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
            ]}
          >
            {favoriteEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isFavorite={isFavorite(event.id)}
                onToggleFavorite={() => toggleFavorite(event.id)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  listContent: {
    flexGrow: 0,
  },
});
