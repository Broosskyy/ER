import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { getDemoEventById } from '@/features/events/data/demo-events';
import { useFavorites } from '@/features/favorites';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = id ? getDemoEventById(id) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={componentSize.iconMd} color={colors.textPrimary} />
              <AppText variant="body">Back</AppText>
            </Pressable>

            {event ? (
              <FavoriteButton
                active={isFavorite(event.id)}
                onPress={() => toggleFavorite(event.id)}
                accessibilityLabel={
                  isFavorite(event.id) ? 'Remove from favorites' : 'Add to favorites'
                }
              />
            ) : null}
          </View>

          <AppText variant="title" style={styles.title}>
            {event?.title ?? 'Event'}
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} style={styles.meta}>
            {event ? `${event.venueName}, ${event.city}` : `Event ID: ${id}`}
          </AppText>
          <AppText variant="body" color={colors.textSecondary} style={styles.note}>
            Event detail implementation pending
          </AppText>
        </ScreenContent>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: componentSize.iconButtonSize,
  },
  pressed: {
    opacity: 0.8,
  },
  title: {
    marginBottom: spacing.sm,
  },
  meta: {
    marginBottom: spacing.lg,
  },
  note: {
    marginTop: spacing.md,
  },
});
