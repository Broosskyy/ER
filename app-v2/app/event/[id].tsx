import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { getDemoEventById } from '@/features/events/data/demo-events';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = id ? getDemoEventById(id) : undefined;

  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={componentSize.iconMd} color={colors.textPrimary} />
            <AppText variant="body">Back</AppText>
          </Pressable>

          <AppText variant="title" style={styles.title}>
            {event?.title ?? 'Event'}
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} style={styles.meta}>
            Event ID: {id}
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: componentSize.iconButtonSize,
    marginBottom: spacing.xl,
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
