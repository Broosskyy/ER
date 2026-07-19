import type { EventRepository } from '@/data/repositories/repositories';
import { createLocalNotificationDatasource } from '@/data/datasources/local/local-notification-datasource';
import type { NotificationDatasource } from '@/data/datasources/local/local-notification-datasource';
import { syncNotifications } from '@/features/notifications/services/notification-sync';
import type { EventSnapshot } from '@/features/notifications/types/event-snapshot';
import type { Notification } from '@/features/notifications/types/notification';

export class NotificationRepository {
  private notifications: Notification[] = [];
  private snapshot: EventSnapshot | null = null;
  private initialized = false;
  private syncPromise: Promise<void> | undefined;

  constructor(
    private readonly eventRepository: EventRepository,
    private readonly datasource: NotificationDatasource = createLocalNotificationDatasource(),
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const [notifications, snapshot] = await Promise.all([
      this.datasource.loadNotifications(),
      this.datasource.loadEventSnapshot(),
    ]);

    this.notifications = notifications;
    this.snapshot = snapshot;
    this.initialized = true;
  }

  async syncWithFavorites(favoriteIds: readonly string[]): Promise<void> {
    await this.initialize();

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.runSync(favoriteIds).finally(() => {
      this.syncPromise = undefined;
    });

    return this.syncPromise;
  }

  private async runSync(favoriteIds: readonly string[]): Promise<void> {
    const events = this.eventRepository.getPublishedEvents();
    const result = syncNotifications({
      events,
      favoriteIds,
      previousSnapshot: this.snapshot,
      existingNotifications: this.notifications,
    });

    this.notifications = result.notifications;
    this.snapshot = result.snapshot;

    await Promise.all([
      this.datasource.saveNotifications(this.notifications),
      this.datasource.saveEventSnapshot(this.snapshot),
    ]);
  }

  getNotifications(): Notification[] {
    this.ensureReady();
    return [...this.notifications].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  getUnreadCount(): number {
    this.ensureReady();
    return this.notifications.filter((notification) => notification.status === 'unread').length;
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.initialize();

    const index = this.notifications.findIndex((notification) => notification.id === notificationId);

    if (index === -1 || this.notifications[index]?.status === 'read') {
      return;
    }

    const readAt = new Date().toISOString();
    this.notifications = this.notifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, status: 'read', readAt }
        : notification,
    );

    await this.datasource.saveNotifications(this.notifications);
  }

  async markAllAsRead(): Promise<void> {
    await this.initialize();

    const hasUnread = this.notifications.some((notification) => notification.status === 'unread');

    if (!hasUnread) {
      return;
    }

    const readAt = new Date().toISOString();
    this.notifications = this.notifications.map((notification) =>
      notification.status === 'unread'
        ? { ...notification, status: 'read', readAt }
        : notification,
    );

    await this.datasource.saveNotifications(this.notifications);
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.initialize();

    const nextNotifications = this.notifications.filter(
      (notification) => notification.id !== notificationId,
    );

    if (nextNotifications.length === this.notifications.length) {
      return;
    }

    this.notifications = nextNotifications;
    await this.datasource.saveNotifications(this.notifications);
  }

  /** @internal Used by tests only. */
  resetForTesting(): void {
    this.initialized = false;
    this.notifications = [];
    this.snapshot = null;
    this.syncPromise = undefined;
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new Error(
        'NotificationRepository is not initialized. Call initialize() or syncWithFavorites() first.',
      );
    }
  }
}
