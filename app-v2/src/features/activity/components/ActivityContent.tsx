import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, SectionList, StyleSheet } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { eventRepository } from '@/features/events';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import {
  getEventDetailRoute,
  groupNotificationsByTime,
  NotificationRow,
  NotificationsEmptyState,
  NotificationsErrorState,
  NotificationsHeader,
  NotificationsLoadingState,
  useNotifications,
} from '@/features/notifications';
import type { NotificationSection } from '@/features/notifications/services/notification-grouping';
import type { Notification as AppNotification } from '@/features/notifications/types/notification';

export type ActivityPresentation = 'screen' | 'panel';

export interface ActivityContentProps {
  presentation?: ActivityPresentation;
  onClose?: () => void;
}

export function ActivityContent({ presentation = 'screen', onClose }: ActivityContentProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const sections = groupNotificationsByTime(notifications);

  const handleNotificationPress = useCallback(
    async (notification: AppNotification) => {
      if (notification.readAt === null) {
        await markAsRead(notification.id);
      }

      if (!notification.eventId) {
        return;
      }

      const event = eventRepository.getEventById(notification.eventId);

      if (!event) {
        Alert.alert(
          t('activity.eventUnavailableTitle'),
          t('activity.eventUnavailableMessage'),
        );
        return;
      }

      onClose?.();
      router.push(getEventDetailRoute(notification.eventId));
    },
    [markAsRead, onClose, router, t],
  );

  const handleDelete = useCallback(
    (notification: AppNotification) => {
      void deleteNotification(notification.id);
    },
    [deleteNotification],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationSection }) => (
      <AppText style={styles.sectionTitle}>{t(section.titleKey)}</AppText>
    ),
    [t],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationRow
        notification={item}
        onPress={handleNotificationPress}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, handleNotificationPress],
  );

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  return (
    <>
      <NotificationsHeader
        unreadCount={unreadCount}
        onMarkAllAsRead={markAllAsRead}
        onClose={presentation === 'panel' ? onClose : undefined}
        presentation={presentation}
      />

      {loading ? (
        <NotificationsLoadingState />
      ) : error ? (
        <NotificationsErrorState message={error} onRetry={refresh} />
      ) : notifications.length === 0 ? (
        <NotificationsEmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacingRoles.listBottomInset,
  },
  sectionTitle: {
    ...textRoles.sectionTitle,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
});
