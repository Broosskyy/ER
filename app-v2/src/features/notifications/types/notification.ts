import type { NotificationMetadata } from './notification-metadata';
import type { NotificationType } from './notification-type';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId: string | null;
  createdAt: string;
  readAt: string | null;
  deletedAt: string | null;
  deduplicationKey: string;
  metadata: NotificationMetadata;
}

export function isNotificationUnread(notification: Notification): boolean {
  return notification.readAt === null && notification.deletedAt === null;
}

export function isNotificationActive(notification: Notification): boolean {
  return notification.deletedAt === null;
}
