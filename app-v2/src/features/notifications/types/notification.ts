import type { NotificationStatus } from './notification-status';
import type { NotificationType } from './notification-type';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId: string;
  createdAt: string;
  readAt: string | null;
  status: NotificationStatus;
  dedupeKey: string;
  imageUrl?: string;
}
