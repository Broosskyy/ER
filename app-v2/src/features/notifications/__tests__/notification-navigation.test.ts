import { describe, expect, it } from 'vitest';

import {
  getActivityRoute,
  getEventDetailRoute,
  getNotificationsRoute,
} from '../services/notification-navigation';

describe('notification navigation', () => {
  it('exposes notification, activity and event routes', () => {
    expect(getNotificationsRoute()).toBe('/notifications');
    expect(getActivityRoute()).toBe('/activity');
    expect(getEventDetailRoute('event-42')).toBe('/event/event-42');
  });
});
