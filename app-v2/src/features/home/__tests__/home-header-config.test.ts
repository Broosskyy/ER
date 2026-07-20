import { describe, expect, it } from 'vitest';

import {
  HOME_HEADER_CONFIG,
  shouldShowNotificationButton,
} from '@/features/home/home-header-config';

describe('home header config', () => {
  it('uses the create button instead of the diamond logo', () => {
    expect(HOME_HEADER_CONFIG.showsDiamondLogo).toBe(false);
    expect(HOME_HEADER_CONFIG.showsCreateButton).toBe(true);
    expect(HOME_HEADER_CONFIG.showsNotificationButton).toBe(true);
    expect(HOME_HEADER_CONFIG.notificationRequiresAuth).toBe(true);
  });

  it('requires authentication before showing the notification button', () => {
    expect(shouldShowNotificationButton(false)).toBe(false);
    expect(shouldShowNotificationButton(true)).toBe(true);
  });
});
