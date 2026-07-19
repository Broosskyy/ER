import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface NotificationsHeaderProps {
  unreadCount: number;
  onMarkAllAsRead?: () => void;
}

export function NotificationsHeader({ unreadCount, onMarkAllAsRead }: NotificationsHeaderProps) {
  const router = useRouter();
  const showMarkAll = unreadCount > 0 && onMarkAllAsRead;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <IconButton icon="arrow-back" accessibilityLabel="Zurück" onPress={() => router.back()} />
        {showMarkAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alle als gelesen markieren"
            onPress={onMarkAllAsRead}
            style={({ pressed, hovered }) => [
              styles.markAllButton,
              (pressed || hovered) && styles.pressed,
            ]}
          >
            <AppText style={styles.markAllText}>Alle als gelesen markieren</AppText>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
      <AppText style={styles.title}>Aktivitäten</AppText>
      <AppText style={styles.subtitle}>
        {unreadCount > 0 ? `${unreadCount} ungelesen` : 'Alles gelesen'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  spacer: {
    width: 44,
  },
  title: {
    ...textRoles.screenTitle,
  },
  subtitle: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  markAllButton: {
    maxWidth: '70%',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  markAllText: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.85,
  },
});
