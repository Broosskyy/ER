import { beforeEach, describe, expect, it } from 'vitest';

import { EventRepository } from '@/data/repositories/repositories';
import { NotificationRepository } from '@/data/repositories/notification-repository';
import type { NotificationDatasource } from '@/data/datasources/local/local-notification-datasource';
import type { EventSnapshot } from '@/features/notifications/types/event-snapshot';
import type { Notification } from '@/features/notifications/types/notification';

class InMemoryNotificationDatasource implements NotificationDatasource {
  notifications: Notification[] = [];
  snapshot: EventSnapshot | null = null;

  loadNotifications(): Promise<Notification[]> {
    return Promise.resolve([...this.notifications]);
  }

  saveNotifications(notifications: readonly Notification[]): Promise<void> {
    this.notifications = [...notifications];
    return Promise.resolve();
  }

  loadEventSnapshot(): Promise<EventSnapshot | null> {
    return Promise.resolve(this.snapshot);
  }

  saveEventSnapshot(snapshot: EventSnapshot): Promise<void> {
    this.snapshot = snapshot;
    return Promise.resolve();
  }
}

describe('NotificationRepository', () => {
  let eventRepository: EventRepository;
  let datasource: InMemoryNotificationDatasource;
  let repository: NotificationRepository;

  beforeEach(() => {
    eventRepository = EventRepository.createDefault();
    datasource = new InMemoryNotificationDatasource();
    repository = new NotificationRepository(eventRepository, datasource);
  });

  it('establishes a snapshot on first sync without notifications', async () => {
    await repository.syncWithFavorites([]);

    expect(repository.getNotifications()).toEqual([]);
    expect(datasource.snapshot).not.toBeNull();
  });

  it('marks notifications as read', async () => {
    datasource.notifications = [
      {
        id: 'notification-1',
        type: 'event_new',
        title: 'Neues Event',
        message: 'Test',
        eventId: 'event-1',
        createdAt: '2026-05-24T10:00:00.000Z',
        readAt: null,
        status: 'unread',
        dedupeKey: 'event_new:event-1',
      },
    ];

    await repository.initialize();
    await repository.markAsRead('notification-1');

    expect(repository.getUnreadCount()).toBe(0);
    expect(datasource.notifications[0]?.status).toBe('read');
  });

  it('marks all notifications as read', async () => {
    datasource.notifications = [
      {
        id: 'notification-1',
        type: 'event_new',
        title: 'A',
        message: 'A',
        eventId: 'event-1',
        createdAt: '2026-05-24T10:00:00.000Z',
        readAt: null,
        status: 'unread',
        dedupeKey: 'event_new:event-1',
      },
      {
        id: 'notification-2',
        type: 'event_updated',
        title: 'B',
        message: 'B',
        eventId: 'event-2',
        createdAt: '2026-05-24T11:00:00.000Z',
        readAt: null,
        status: 'unread',
        dedupeKey: 'event_updated:event-2:1',
      },
    ];

    await repository.initialize();
    await repository.markAllAsRead();

    expect(repository.getUnreadCount()).toBe(0);
    expect(datasource.notifications.every((item) => item.status === 'read')).toBe(true);
  });

  it('deletes a notification', async () => {
    datasource.notifications = [
      {
        id: 'notification-1',
        type: 'event_new',
        title: 'Neues Event',
        message: 'Test',
        eventId: 'event-1',
        createdAt: '2026-05-24T10:00:00.000Z',
        readAt: null,
        status: 'unread',
        dedupeKey: 'event_new:event-1',
      },
    ];

    await repository.initialize();
    await repository.deleteNotification('notification-1');

    expect(repository.getNotifications()).toEqual([]);
    expect(datasource.notifications).toEqual([]);
  });

  it('persists state through initialize after sync', async () => {
    await repository.syncWithFavorites([]);

    const reloaded = new NotificationRepository(eventRepository, datasource);
    await reloaded.initialize();

    expect(reloaded.getNotifications()).toEqual(repository.getNotifications());
    expect(datasource.snapshot).not.toBeNull();
  });
});
