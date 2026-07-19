import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import {
  formatNotificationTimestamp,
  getNotificationIconName,
} from '@/features/notifications/services/notification-ui';
import type { Notification } from '@/features/notifications/types/notification';

export interface NotificationRowProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onDelete?: (notification: Notification) => void;
}

export function NotificationRow({ notification, onPress, onDelete }: NotificationRowProps) {
  const isUnread = notification.status === 'unread';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.leading}>
        {notification.imageUrl ? (
          <Image source={{ uri: notification.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.iconWrap}>
            <Ionicons
              name={getNotificationIconName(notification.type)}
              size={20}
              color={colors.primary}
            />
          </View>
        )}
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <AppText
            style={isUnread ? styles.titleUnread : styles.title}
            numberOfLines={1}
          >
            {notification.title}
          </AppText>
          <AppText style={styles.timestamp}>
            {formatNotificationTimestamp(notification.createdAt)}
          </AppText>
        </View>
        <AppText style={styles.message} numberOfLines={2}>
          {notification.message}
        </AppText>
      </View>

      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Benachrichtigung löschen"
          hitSlop={8}
          onPress={() => onDelete(notification)}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={16} color={colorRoles.emptyStateDescription} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  leading: {
    position: 'relative',
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...textRoles.metadata,
    color: colors.textSecondary,
    flex: 1,
  },
  titleUnread: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  timestamp: {
    ...textRoles.badge,
    color: colorRoles.emptyStateDescription,
  },
  message: {
    ...textRoles.body,
    color: colors.textPrimary,
  },
  deleteButton: {
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
});
