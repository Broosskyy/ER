import AsyncStorage from '@react-native-async-storage/async-storage';

import { isEventStatus } from '@/features/events/types/event-status';

import type { EventSnapshot, EventSnapshotEntry, NotificationSyncState } from '../types/event-snapshot';

export const EVENT_SNAPSHOT_STORAGE_KEY = '@eternal_rave/event_snapshot_v2';
export const NOTIFICATION_SYNC_STORAGE_KEY = '@eternal_rave/notification_sync_v2';

function isSnapshotEntry(value: unknown): value is EventSnapshotEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.startDateTime === 'string' &&
    typeof record.venue === 'string' &&
    typeof record.status === 'string' &&
    isEventStatus(record.status) &&
    typeof record.updatedAt === 'string' &&
    (record.ticketUrl === undefined || typeof record.ticketUrl === 'string')
  );
}

function parseStoredSnapshot(raw: string | null): EventSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (record.version !== 1 || typeof record.capturedAt !== 'string' || !record.events) {
      return null;
    }

    if (typeof record.events !== 'object' || record.events === null) {
      return null;
    }

    const events: Record<string, EventSnapshotEntry> = {};

    for (const [eventId, entry] of Object.entries(record.events)) {
      if (isSnapshotEntry(entry)) {
        events[eventId] = entry;
      }
    }

    return {
      version: 1,
      capturedAt: record.capturedAt,
      events,
    };
  } catch {
    return null;
  }
}

function parseSyncState(raw: string | null): NotificationSyncState {
  if (!raw) {
    return { version: 1, lastSuccessfulSyncAt: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, lastSuccessfulSyncAt: null };
    }

    const record = parsed as Record<string, unknown>;

    if (record.version !== 1) {
      return { version: 1, lastSuccessfulSyncAt: null };
    }

    return {
      version: 1,
      lastSuccessfulSyncAt:
        record.lastSuccessfulSyncAt === null || typeof record.lastSuccessfulSyncAt === 'string'
          ? record.lastSuccessfulSyncAt
          : null,
    };
  } catch {
    return { version: 1, lastSuccessfulSyncAt: null };
  }
}

export async function loadEventSnapshotFromStorage(): Promise<EventSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_SNAPSHOT_STORAGE_KEY);
    return parseStoredSnapshot(raw);
  } catch {
    return null;
  }
}

export async function saveEventSnapshotToStorage(snapshot: EventSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENT_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Persist errors must not crash the app.
  }
}

export async function loadNotificationSyncStateFromStorage(): Promise<NotificationSyncState> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SYNC_STORAGE_KEY);
    return parseSyncState(raw);
  } catch {
    return { version: 1, lastSuccessfulSyncAt: null };
  }
}

export async function saveNotificationSyncStateToStorage(state: NotificationSyncState): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SYNC_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persist errors must not crash the app.
  }
}
