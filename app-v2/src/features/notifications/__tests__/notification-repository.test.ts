import { beforeEach, describe, expect, it } from 'vitest';

import type { NotificationDatasource } from '@/data/datasources/local/local-notification-datasource';
import { NotificationRepository } from '@/data/repositories/notification-repository';
import { EventRepository } from '@/data/repositories/repositories';
import type { EventSnapshot, NotificationSyncState } from '@/features/notifications/types/event-snapshot';
import type { Notification } from '@/features/notifications/types/notification';

class InMemoryNotificationDatasource implements NotificationDatasource {
  notifications: Notification[] = [];
  snapshot: EventSnapshot | null = null;
  syncState: NotificationSyncState = { version: 1, lastSuccessfulSyncAt: null };

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

  loadSyncState(): Promise<NotificationSyncState> {
    return Promise.resolve(this.syncState);
  }

  saveSyncState(state: NotificationSyncState): Promise<void> {
    this.syncState = state;
    return Promise.resolve();
  }
}

function createNotification(id: string, overrides: Partial<Notification> = {}): Notification {
  return {
    id,
    type: 'new_event',
    title: 'Neues Event',
    message: 'Test',
    eventId: 'event-1',
    createdAt: '2026-05-24T10:00:00.000Z',
    readAt: null,
    deletedAt: null,
    deduplicationKey: `event-1:new_event:${id}`,
    metadata: {},
    ...overrides,
  };
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

  it('lists active notifications', async () => {
    datasource.notifications = [createNotification('n-1')];
    await repository.initialize();
    expect(repository.list()).toHaveLength(1);
  });

  it('creates and retrieves notifications', async () => {
    const created = await repository.create({
      type: 'general',
      title: 'Info',
      message: 'Hinweis',
      eventId: null,
      deduplicationKey: 'general:general:v1',
      metadata: {},
    });

    expect(repository.getById(created.id)?.title).toBe('Info');
  });

  it('marks notifications as read and updates unread count', async () => {
    datasource.notifications = [createNotification('n-1')];
    await repository.initialize();
    await repository.markAsRead('n-1');
    expect(repository.getUnreadCount()).toBe(0);
  });

  it('marks all notifications as read', async () => {
    datasource.notifications = [createNotification('n-1'), createNotification('n-2')];
    await repository.initialize();
    await repository.markAllAsRead();
    expect(repository.getUnreadCount()).toBe(0);
  });

  it('soft deletes notifications and keeps deduplication keys', async () => {
    datasource.notifications = [createNotification('n-1')];
    await repository.initialize();
    await repository.delete('n-1');
    expect(repository.list()).toEqual([]);
    expect(repository.existsByDeduplicationKey('event-1:new_event:n-1')).toBe(true);
  });

  it('clears all notifications', async () => {
    datasource.notifications = [createNotification('n-1')];
    await repository.initialize();
    await repository.clear();
    expect(repository.list()).toEqual([]);
  });

  it('persists through initialize after sync', async () => {
    await repository.sync({ favoriteIds: [] });
    const reloaded = new NotificationRepository(eventRepository, datasource);
    await reloaded.initialize();
    expect(reloaded.list().length).toBe(repository.list().length);
    expect(datasource.snapshot).not.toBeNull();
  });
});
