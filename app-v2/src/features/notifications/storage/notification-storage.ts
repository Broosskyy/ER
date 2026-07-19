import AsyncStorage from '@react-native-async-storage/async-storage';

import { isNotificationType } from '../types/notification-type';
import { isNotificationMetadata } from '../types/notification-metadata';
import type { Notification } from '../types/notification';

export const NOTIFICATIONS_STORAGE_KEY = '@eternal_rave/notifications_v2';

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
    (record.eventId === null || typeof record.eventId === 'string') &&
    typeof record.createdAt === 'string' &&
    (record.readAt === null || typeof record.readAt === 'string') &&
    (record.deletedAt === null || typeof record.deletedAt === 'string') &&
    typeof record.deduplicationKey === 'string' &&
    isNotificationMetadata(record.metadata)
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
