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
import type { Notification } from '@/features/notifications/types/notification';
import {
  formatNotificationBadgeCount,
  getUnreadNotificationCount,
} from '@/features/notifications/services/notification-navigation';

export type NotificationsLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  badgeLabel: string | null;
  loadState: NotificationsLoadState;
  errorMessage: string | null;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadState, setLoadState] = useState<NotificationsLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const syncNotifications = useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setLoadState('loading');
      setErrorMessage(null);
    }

    try {
      await notificationRepository.syncWithFavorites(Array.from(favoriteIds));
      setNotifications(notificationRepository.getNotifications());
      setLoadState('ready');
    } catch (error: unknown) {
      setLoadState('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Benachrichtigungen konnten nicht geladen werden.',
      );
    }
  }, [favoriteIds]);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    let active = true;

    async function runInitialSync() {
      try {
        await notificationRepository.syncWithFavorites(Array.from(favoriteIds));

        if (!active) {
          return;
        }

        setNotifications(notificationRepository.getNotifications());
        setLoadState('ready');
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!active) {
          return;
        }

        setLoadState('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Benachrichtigungen konnten nicht geladen werden.',
        );
      }
    }

    void runInitialSync();

    return () => {
      active = false;
    };
  }, [favoriteIds, favoritesHydrated]);

  const refresh = useCallback(async () => {
    await syncNotifications(true);
  }, [syncNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await notificationRepository.markAsRead(notificationId);
    setNotifications(notificationRepository.getNotifications());
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationRepository.markAllAsRead();
    setNotifications(notificationRepository.getNotifications());
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await notificationRepository.deleteNotification(notificationId);
    setNotifications(notificationRepository.getNotifications());
  }, []);

  const unreadCount = useMemo(() => getUnreadNotificationCount(notifications), [notifications]);
  const badgeLabel = useMemo(() => formatNotificationBadgeCount(unreadCount), [unreadCount]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      badgeLabel,
      loadState,
      errorMessage,
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
      errorMessage,
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
