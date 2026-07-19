import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import {
  getEventDetailPath,
  groupNotificationsByTime,
  NotificationRow,
  NotificationsEmptyState,
  NotificationsErrorState,
  NotificationsHeader,
  NotificationsLoadingState,
  useNotifications,
} from '@/features/notifications';
import type { Notification } from '@/features/notifications/types/notification';
import type { NotificationSection } from '@/features/notifications/services/notification-grouping';

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loadState,
    errorMessage,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const sections = groupNotificationsByTime(notifications);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (notification.status === 'unread') {
        await markAsRead(notification.id);
      }

      router.push(getEventDetailPath(notification.eventId));
    },
    [markAsRead, router],
  );

  const handleDelete = useCallback(
    (notification: Notification) => {
      void deleteNotification(notification.id);
    },
    [deleteNotification],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationSection }) => (
      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle}>{section.title}</AppText>
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationRow
        notification={item}
        onPress={handleNotificationPress}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, handleNotificationPress],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <NotificationsHeader unreadCount={unreadCount} onMarkAllAsRead={markAllAsRead} />

        {loadState === 'loading' ? (
          <NotificationsLoadingState />
        ) : loadState === 'error' ? (
          <NotificationsErrorState message={errorMessage ?? ''} onRetry={refresh} />
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
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...textRoles.sectionTitle,
    color: colors.textSecondary,
  },
});
