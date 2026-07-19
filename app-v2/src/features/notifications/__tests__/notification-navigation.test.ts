import { describe, expect, it } from 'vitest';

import {
  getEventDetailRoute,
  getNotificationsRoute,
} from '../services/notification-navigation';

describe('notification navigation', () => {
  it('exposes notification and event routes', () => {
    expect(getNotificationsRoute()).toBe('/notifications');
    expect(getEventDetailRoute('event-42')).toBe('/event/event-42');
  });
});
