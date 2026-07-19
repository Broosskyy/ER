import type { EventSnapshot, NotificationSyncState } from '@/features/notifications/types/event-snapshot';
import type { Notification } from '@/features/notifications/types/notification';
import {
  loadEventSnapshotFromStorage,
  loadNotificationSyncStateFromStorage,
  saveEventSnapshotToStorage,
  saveNotificationSyncStateToStorage,
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
  loadSyncState(): Promise<NotificationSyncState>;
  saveSyncState(state: NotificationSyncState): Promise<void>;
}

export function createLocalNotificationDatasource(): NotificationDatasource {
  return {
    loadNotifications: loadNotificationsFromStorage,
    saveNotifications: saveNotificationsToStorage,
    loadEventSnapshot: loadEventSnapshotFromStorage,
    saveEventSnapshot: saveEventSnapshotToStorage,
    loadSyncState: loadNotificationSyncStateFromStorage,
    saveSyncState: saveNotificationSyncStateToStorage,
  };
}
