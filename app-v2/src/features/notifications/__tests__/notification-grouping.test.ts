import { describe, expect, it } from 'vitest';

import {
  getNotificationTimeGroup,
  groupNotificationsByTime,
} from '../services/notification-grouping';
import type { Notification } from '../types/notification';

function createNotification(createdAt: string): Notification {
  return {
    id: `notification-${createdAt}`,
    type: 'event_new',
    title: 'Neues Event',
    message: 'Test',
    eventId: 'event-1',
    createdAt,
    readAt: null,
    status: 'unread',
    dedupeKey: `event_new:event-1:${createdAt}`,
  };
}

describe('notification grouping', () => {
  const referenceDate = new Date('2026-05-24T15:00:00.000Z');

  it('groups notifications into Heute, Diese Woche and Früher', () => {
    const notifications = [
      createNotification('2026-05-24T10:00:00.000Z'),
      createNotification('2026-05-22T10:00:00.000Z'),
      createNotification('2026-05-10T10:00:00.000Z'),
    ];

    const sections = groupNotificationsByTime(notifications, referenceDate);

    expect(sections.map((section) => section.title)).toEqual([
      'Heute',
      'Diese Woche',
      'Früher',
    ]);
  });

  it('classifies same-day notifications as today', () => {
    expect(
      getNotificationTimeGroup('2026-05-24T08:00:00.000Z', referenceDate),
    ).toBe('today');
  });
});
