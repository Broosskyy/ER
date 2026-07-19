import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, SectionList, StyleSheet } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { eventRepository } from '@/features/events';
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

export default function NotificationsScreen() {
  const router = useRouter();
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
          'Event nicht verfügbar',
          'Dieses Event ist nicht mehr verfügbar.',
        );
        return;
      }

      router.push(getEventDetailRoute(notification.eventId));
    },
    [markAsRead, router],
  );

  const handleDelete = useCallback(
    (notification: AppNotification) => {
      void deleteNotification(notification.id);
    },
    [deleteNotification],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationSection }) => (
      <AppText style={styles.sectionTitle}>{section.title}</AppText>
    ),
    [],
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
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <NotificationsHeader unreadCount={unreadCount} onMarkAllAsRead={markAllAsRead} />

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
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
