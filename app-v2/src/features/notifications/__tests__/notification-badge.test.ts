import { describe, expect, it } from 'vitest';

import {
  formatNotificationBadgeLabel,
  getUnreadNotificationCount,
} from '../services/notification-badge';
import type { Notification } from '../types/notification';

function createNotification(readAt: string | null, deletedAt: string | null = null): Notification {
  return {
    id: 'notification-1',
    type: 'new_event',
    title: 'Neues Event',
    message: 'Test',
    eventId: 'event-1',
    createdAt: '2026-05-24T10:00:00.000Z',
    readAt,
    deletedAt,
    deduplicationKey: 'event-1:new_event:v1',
    metadata: {},
  };
}

describe('notification badge', () => {
  it('counts unread active notifications', () => {
    const notifications = [
      createNotification(null),
      createNotification('2026-05-24T11:00:00.000Z'),
      createNotification(null, '2026-05-24T12:00:00.000Z'),
    ];

    expect(getUnreadNotificationCount(notifications)).toBe(1);
  });

  it('formats badge labels', () => {
    expect(formatNotificationBadgeLabel(0)).toBeNull();
    expect(formatNotificationBadgeLabel(3)).toBe('3');
    expect(formatNotificationBadgeLabel(10)).toBe('9+');
  });
});
