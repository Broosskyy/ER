import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { notificationRepository } from '@/data/repositories/registry';
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
  const { favoriteIds, isHydrated: favoritesHydrated } = useFavorites();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadState, setLoadState] = useState<NotificationsLoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  const syncNotifications = useCallback(async () => {
    await notificationRepository.sync({
      favoriteIds: Array.from(favoriteIds),
    });
    setNotifications(notificationRepository.list());
  }, [favoriteIds]);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    setError(null);

    try {
      await syncNotifications();
      setLoadState('ready');
    } catch (cause: unknown) {
      setLoadState('error');
      setError(
        cause instanceof Error
          ? cause.message
          : 'Aktivitäten konnten nicht geladen werden.',
      );
    }
  }, [syncNotifications]);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    let active = true;

    async function runInitialSync() {
      try {
        await notificationRepository.sync({
          favoriteIds: Array.from(favoriteIds),
        });

        if (!active) {
          return;
        }

        setNotifications(notificationRepository.list());
        setLoadState('ready');
        setError(null);
      } catch (cause: unknown) {
        if (!active) {
          return;
        }

        setLoadState('error');
        setError(
          cause instanceof Error
            ? cause.message
            : 'Aktivitäten konnten nicht geladen werden.',
        );
      }
    }

    void runInitialSync();

    return () => {
      active = false;
    };
  }, [favoriteIds, favoritesHydrated]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await notificationRepository.markAsRead(notificationId);
    setNotifications(notificationRepository.list());
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationRepository.markAllAsRead();
    setNotifications(notificationRepository.list());
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await notificationRepository.delete(notificationId);
    setNotifications(notificationRepository.list());
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter(isNotificationUnread).length,
    [notifications],
  );

  const badgeLabel = useMemo(
    () => formatNotificationBadgeLabel(unreadCount),
    [unreadCount],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      badgeLabel,
      loading: loadState === 'loading',
      error,
      refresh,
      markAsRead,
      markAllAsRead,
      deleteNotification,
    }),
    [
      notifications,
      unreadCount,
      badgeLabel,
      loadState,
      error,
      refresh,
      markAsRead,
      markAllAsRead,
      deleteNotification,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }

  return context;
}
