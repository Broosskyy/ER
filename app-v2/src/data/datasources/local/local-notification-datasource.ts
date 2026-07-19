import type { EventSnapshot } from '@/features/notifications/types/event-snapshot';
import type { Notification } from '@/features/notifications/types/notification';
import {
  loadEventSnapshotFromStorage,
  saveEventSnapshotToStorage,
} from '@/features/notifications/storage/event-snapshot-storage';
import {
  loadNotificationsFromStorage,
  saveNotificationsToStorage,
} from '@/features/notifications/storage/notification-storage';

export interface NotificationDatasource {
  loadNotifications(): Promise<Notification[]>;
  saveNotifications(notifications: readonly Notification[]): Promise<void>;
  loadEventSnapshot(): Promise<EventSnapshot | null>;
  saveEventSnapshot(snapshot: EventSnapshot): Promise<void>;
}

export function createLocalNotificationDatasource(): NotificationDatasource {
  return {
    loadNotifications: loadNotificationsFromStorage,
    saveNotifications: saveNotificationsToStorage,
    loadEventSnapshot: loadEventSnapshotFromStorage,
    saveEventSnapshot: saveEventSnapshotToStorage,
  };
}
