import type { Notification } from '../types/notification';
import { isNotificationUnread } from '../types/notification';

export function getUnreadNotificationCount(notifications: readonly Notification[]): number {
  return notifications.filter(isNotificationUnread).length;
}

export function formatNotificationBadgeLabel(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  if (count >= 10) {
    return '9+';
  }

  return String(count);
}
