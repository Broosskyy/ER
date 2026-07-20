import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export type ActivityPresentation = 'screen' | 'panel';

export interface NotificationsHeaderProps {
  unreadCount: number;
  onMarkAllAsRead?: () => void;
  onClose?: () => void;
  presentation?: ActivityPresentation;
}

export function NotificationsHeader({
  unreadCount,
  onMarkAllAsRead,
  onClose,
  presentation = 'screen',
}: NotificationsHeaderProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const showMarkAll = unreadCount > 0 && onMarkAllAsRead;
  const isPanel = presentation === 'panel';

  const handleNavigateBack = () => {
    if (onClose) {
      onClose();
      return;
    }

    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <IconButton
          icon={isPanel ? 'close' : 'arrow-back'}
          accessibilityLabel={
            isPanel ? t('activity.closeA11y') : t('common.actions.back')
          }
          onPress={handleNavigateBack}
        />
        {showMarkAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('activity.markAllRead')}
            onPress={onMarkAllAsRead}
            style={({ pressed, hovered }) => [
              styles.markAllButton,
              (pressed || hovered) && styles.pressed,
            ]}
          >
            <AppText style={styles.markAllText}>{t('activity.markAllRead')}</AppText>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
      <AppText style={styles.title}>{t('activity.title')}</AppText>
      <AppText style={styles.subtitle}>
        {unreadCount > 0 ? t('activity.unread', { count: unreadCount }) : t('activity.allRead')}
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
