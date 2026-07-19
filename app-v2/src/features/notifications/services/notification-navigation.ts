import type { Notification } from '../types/notification';

export function getUnreadNotificationCount(notifications: readonly Notification[]): number {
  return notifications.filter((notification) => notification.status === 'unread').length;
}

export function formatNotificationBadgeCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  if (count >= 10) {
    return '9+';
  }

  return String(count);
}

export function getNotificationScreenPath(): '/notifications' {
  return '/notifications';
}

export function getEventDetailPath(eventId: string): `/event/${string}` {
  return `/event/${eventId}`;
}
