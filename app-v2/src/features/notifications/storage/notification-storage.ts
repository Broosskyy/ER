import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Notification } from '../types/notification';
import { isNotificationStatus } from '../types/notification-status';
import { isNotificationType } from '../types/notification-type';

export const NOTIFICATIONS_STORAGE_KEY = '@eternal_rave/notifications_v1';

function isNotificationRecord(value: unknown): value is Notification {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    typeof record.type === 'string' &&
    isNotificationType(record.type) &&
    typeof record.title === 'string' &&
    typeof record.message === 'string' &&
    typeof record.eventId === 'string' &&
    typeof record.createdAt === 'string' &&
    (record.readAt === null || typeof record.readAt === 'string') &&
    typeof record.status === 'string' &&
    isNotificationStatus(record.status) &&
    typeof record.dedupeKey === 'string' &&
    (record.imageUrl === undefined || typeof record.imageUrl === 'string')
  );
}

function parseStoredNotifications(raw: string | null): Notification[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isNotificationRecord);
  } catch {
    return [];
  }
}

export async function loadNotificationsFromStorage(): Promise<Notification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return parseStoredNotifications(raw);
  } catch {
    return [];
  }
}

export async function saveNotificationsToStorage(
  notifications: readonly Notification[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // Persist errors must not crash the app.
  }
}
