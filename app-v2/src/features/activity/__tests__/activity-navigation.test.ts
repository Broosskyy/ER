import { describe, expect, it } from 'vitest';

import { resolveActivityPanelLayout } from '@/features/activity/activity-panel-layout';
import { getActivityRoute, getNotificationsRoute } from '@/features/notifications/services/notification-navigation';

describe('activity navigation', () => {
  it('keeps notifications and activity deep-link routes available', () => {
    expect(getNotificationsRoute()).toBe('/notifications');
    expect(getActivityRoute()).toBe('/activity');
  });

  it('uses a web drawer layout on web and a mobile modal elsewhere', () => {
    expect(resolveActivityPanelLayout('web')).toBe('web-drawer');
    expect(resolveActivityPanelLayout('ios')).toBe('mobile-modal');
    expect(resolveActivityPanelLayout('android')).toBe('mobile-modal');
  });
});
