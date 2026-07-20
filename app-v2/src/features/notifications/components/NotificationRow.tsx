import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import {
  formatNotificationTimestamp,
  getNotificationIconName,
} from '@/features/notifications/services/notification-ui';
import { isNotificationUnread } from '@/features/notifications/types/notification';
import type { Notification } from '@/features/notifications/types/notification';

export interface NotificationRowProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onDelete: (notification: Notification) => void;
}

export function NotificationRow({ notification, onPress, onDelete }: NotificationRowProps) {
  const unread = isNotificationUnread(notification);
  const imageUrl = notification.metadata.imageUrl;

  return (
    <InteractiveCard
      accessibilityLabel={`${notification.title}. ${notification.message}. ${unread ? 'Ungelesen' : 'Gelesen'}`}
      onPress={() => onPress(notification)}
      style={[styles.container, unread && styles.unreadContainer]}
      pressableStyle={styles.pressable}
      pressedStyle={styles.pressed}
      actionsPlacement="trailing"
      actions={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Benachrichtigung löschen"
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onDelete(notification);
          }}
          style={({ pressed, hovered }) => [
            styles.deleteButton,
            (pressed || hovered) && styles.pressed,
          ]}
        >
          <Ionicons name="close" size={16} color={colorRoles.emptyStateDescription} />
        </Pressable>
      }
      actionsStyle={styles.deleteWrap}
    >
      <View style={styles.leading}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.iconWrap}>
            <Ionicons
              name={getNotificationIconName(notification.type)}
              size={20}
              color={colors.primary}
            />
          </View>
        )}
        {unread ? <View style={styles.unreadDot} accessibilityLabel="Ungelesen" /> : null}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <AppText style={unread ? styles.titleUnread : styles.title} numberOfLines={1}>
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
    </InteractiveCard>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unreadContainer: {
    backgroundColor: colors.surface,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  leading: {
    position: 'relative',
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
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
    minWidth: 0,
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
    ...textRoles.metadata,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    ...textRoles.badge,
    color: colorRoles.emptyStateDescription,
  },
  message: {
    ...textRoles.body,
    color: colors.textPrimary,
  },
  deleteWrap: {
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
    paddingRight: spacing.lg,
  },
  deleteButton: {
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
});
