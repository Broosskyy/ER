import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useFavorites } from '@/features/favorites';
import { formatNotificationBadgeLabel } from '@/features/notifications/services/notification-badge';
import { isNotificationUnread } from '@/features/notifications/types/notification';
import type { Notification as AppNotification } from '@/features/notifications/types/notification';

export type NotificationsLoadState = 'loading' | 'ready' | 'error';

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  badgeLabel: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export interface NotificationsProviderProps {
  children: ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const { isHydrated: favoritesHydrated } = useFavorites();
  const [notifications] = useState<AppNotification[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => isNotificationUnread(notification)).length,
    [notifications],
  );

  const badgeLabel = useMemo(
    () => formatNotificationBadgeLabel(unreadCount),
    [unreadCount],
  );

  const refresh = useCallback(async () => undefined, []);
  const markAsRead = useCallback(async (_notificationId: string) => undefined, []);
  const markAllAsRead = useCallback(async () => undefined, []);
  const deleteNotification = useCallback(async (_notificationId: string) => undefined, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      badgeLabel,
      loading: !favoritesHydrated,
      error: null,
      refresh,
      markAsRead,
      markAllAsRead,
      deleteNotification,
    }),
    [
      badgeLabel,
      deleteNotification,
      favoritesHydrated,
      markAllAsRead,
      markAsRead,
      notifications,
      refresh,
      unreadCount,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
