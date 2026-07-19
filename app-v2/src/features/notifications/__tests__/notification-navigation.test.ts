import { describe, expect, it } from 'vitest';

import {
  formatNotificationBadgeCount,
  getEventDetailPath,
  getNotificationScreenPath,
  getUnreadNotificationCount,
} from '../services/notification-navigation';
import type { Notification } from '../types/notification';

function createNotification(status: Notification['status']): Notification {
  return {
    id: 'notification-1',
    type: 'event_new',
    title: 'Neues Event',
    message: 'Test',
    eventId: 'event-1',
    createdAt: '2026-05-24T10:00:00.000Z',
    readAt: status === 'read' ? '2026-05-24T11:00:00.000Z' : null,
    status,
    dedupeKey: 'event_new:event-1',
  };
}

describe('notification navigation and badge', () => {
  it('exposes the notifications screen path', () => {
    expect(getNotificationScreenPath()).toBe('/notifications');
  });

  it('builds event detail paths', () => {
    expect(getEventDetailPath('event-42')).toBe('/event/event-42');
  });

  it('counts unread notifications', () => {
    const notifications = [createNotification('unread'), createNotification('read')];
    expect(getUnreadNotificationCount(notifications)).toBe(1);
  });

  it('formats badge counts for 1-9', () => {
    expect(formatNotificationBadgeCount(0)).toBeNull();
    expect(formatNotificationBadgeCount(1)).toBe('1');
    expect(formatNotificationBadgeCount(9)).toBe('9');
  });

  it('formats badge counts as 9+ from 10 onward', () => {
    expect(formatNotificationBadgeCount(10)).toBe('9+');
    expect(formatNotificationBadgeCount(25)).toBe('9+');
  });
});
