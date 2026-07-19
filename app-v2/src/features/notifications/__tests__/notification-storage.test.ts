import { describe, expect, it, vi } from 'vitest';

import {
  NOTIFICATIONS_STORAGE_KEY,
  loadNotificationsFromStorage,
  saveNotificationsToStorage,
} from '../storage/notification-storage';
import type { Notification } from '../types/notification';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

const sampleNotification: Notification = {
  id: 'notification-1',
  type: 'event_new',
  title: 'Neues Event',
  message: 'VOID: Techno Saturday wurde hinzugefügt.',
  eventId: 'event-1',
  createdAt: '2026-05-24T10:00:00.000Z',
  readAt: null,
  status: 'unread',
  dedupeKey: 'event_new:event-1',
};

describe('notification storage', () => {
  it('uses the central storage key', () => {
    expect(NOTIFICATIONS_STORAGE_KEY).toBe('@eternal_rave/notifications_v1');
  });

  it('persists and loads notifications', async () => {
    await saveNotificationsToStorage([sampleNotification]);
    const loaded = await loadNotificationsFromStorage();

    expect(loaded).toEqual([sampleNotification]);
  });

  it('returns an empty list for corrupted storage data', async () => {
    storage.set(NOTIFICATIONS_STORAGE_KEY, '{not-json');
    const loaded = await loadNotificationsFromStorage();
    expect(loaded).toEqual([]);
  });
});
