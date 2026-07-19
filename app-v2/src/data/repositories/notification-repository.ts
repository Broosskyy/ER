import type { NotificationDatasource } from '@/data/datasources/local/local-notification-datasource';
import { createLocalNotificationDatasource } from '@/data/datasources/local/local-notification-datasource';
import type { EventRepository } from '@/data/repositories/repositories';
import { appConfig } from '@/design/layout';
import {
  derivePreferredGenres,
  generateNotifications,
  type NotificationGenerationPreferences,
} from '@/features/notifications/services/notification-generation';
import { isNotificationActive, isNotificationUnread } from '@/features/notifications/types/notification';
import type { Notification } from '@/features/notifications/types/notification';
import type { EventSnapshot } from '@/features/notifications/types/event-snapshot';

export interface NotificationSyncContext {
  favoriteIds: readonly string[];
}

function createNotificationId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

  async sync(context: NotificationSyncContext): Promise<void> {
    await this.initialize();

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.runSync(context).finally(() => {
      this.syncPromise = undefined;
    });

    return this.syncPromise;
  }

  private async runSync(context: NotificationSyncContext): Promise<void> {
    const events = this.eventRepository.getPublishedEvents();
    const preferences: NotificationGenerationPreferences = {
      favoriteIds: context.favoriteIds,
      preferredCity: appConfig.defaultCity,
      preferredGenres: derivePreferredGenres(events, context.favoriteIds),
    };

    const knownDeduplicationKeys = new Set(
      this.notifications.map((notification) => notification.deduplicationKey),
    );

    const result = generateNotifications({
      events,
      preferences,
      previousSnapshot: this.snapshot,
      existingNotifications: this.notifications,
      knownDeduplicationKeys,
    });

    if (result.created.length > 0) {
      this.notifications = [...result.created, ...this.notifications];
      await this.datasource.saveNotifications(this.notifications);
    }

    this.snapshot = result.snapshot;
    await this.datasource.saveEventSnapshot(this.snapshot);

    await this.datasource.saveSyncState({
      version: 1,
      lastSuccessfulSyncAt: new Date().toISOString(),
    });
  }

  list(): Notification[] {
    this.ensureReady();
    return this.getActiveNotifications().sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  getById(id: string): Notification | undefined {
    this.ensureReady();
    return this.notifications.find((notification) => notification.id === id);
  }

  async create(
    input: Omit<Notification, 'id' | 'createdAt' | 'readAt' | 'deletedAt'>,
  ): Promise<Notification> {
    await this.initialize();

    if (this.existsByDeduplicationKey(input.deduplicationKey)) {
      const existing = this.notifications.find(
        (notification) => notification.deduplicationKey === input.deduplicationKey,
      );

      if (existing) {
        return existing;
      }
    }

    const notification: Notification = {
      id: createNotificationId(),
      createdAt: new Date().toISOString(),
      readAt: null,
      deletedAt: null,
      ...input,
    };

    this.notifications = [notification, ...this.notifications];
    await this.datasource.saveNotifications(this.notifications);
    return notification;
  }

  async createBatch(inputs: Array<Omit<Notification, 'id' | 'createdAt' | 'readAt' | 'deletedAt'>>): Promise<Notification[]> {
    await this.initialize();

    const created: Notification[] = [];

    for (const input of inputs) {
      if (this.existsByDeduplicationKey(input.deduplicationKey)) {
        continue;
      }

      created.push({
        id: createNotificationId(),
        createdAt: new Date().toISOString(),
        readAt: null,
        deletedAt: null,
        ...input,
      });
    }

    if (created.length === 0) {
      return [];
    }

    this.notifications = [...created, ...this.notifications];
    await this.datasource.saveNotifications(this.notifications);
    return created;
  }

  async markAsRead(id: string): Promise<void> {
    await this.initialize();

    const target = this.notifications.find((notification) => notification.id === id);

    if (!target || target.readAt !== null) {
      return;
    }

    const readAt = new Date().toISOString();
    this.notifications = this.notifications.map((notification) =>
      notification.id === id ? { ...notification, readAt } : notification,
    );

    await this.datasource.saveNotifications(this.notifications);
  }

  async markAllAsRead(): Promise<void> {
    await this.initialize();

    const hasUnread = this.notifications.some(isNotificationUnread);

    if (!hasUnread) {
      return;
    }

    const readAt = new Date().toISOString();
    this.notifications = this.notifications.map((notification) =>
      isNotificationUnread(notification) ? { ...notification, readAt } : notification,
    );

    await this.datasource.saveNotifications(this.notifications);
  }

  async delete(id: string): Promise<void> {
    await this.initialize();

    const target = this.notifications.find((notification) => notification.id === id);

    if (!target || target.deletedAt !== null) {
      return;
    }

    const deletedAt = new Date().toISOString();
    this.notifications = this.notifications.map((notification) =>
      notification.id === id ? { ...notification, deletedAt } : notification,
    );

    await this.datasource.saveNotifications(this.notifications);
  }

  async clear(): Promise<void> {
    await this.initialize();
    this.notifications = [];
    await this.datasource.saveNotifications(this.notifications);
  }

  getUnreadCount(): number {
    this.ensureReady();
    return this.getActiveNotifications().filter(isNotificationUnread).length;
  }

  existsByDeduplicationKey(key: string): boolean {
    this.ensureReady();
    return this.notifications.some((notification) => notification.deduplicationKey === key);
  }

  /** @internal Used by tests only. */
  resetForTesting(): void {
    this.initialized = false;
    this.notifications = [];
    this.snapshot = null;
    this.syncPromise = undefined;
  }

  private getActiveNotifications(): Notification[] {
    return this.notifications.filter(isNotificationActive);
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new Error(
        'NotificationRepository is not initialized. Call initialize() or sync() first.',
      );
    }
  }
}
