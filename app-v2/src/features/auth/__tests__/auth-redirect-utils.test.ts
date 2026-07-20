import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_CALLBACK_PATH,
  buildAuthCallbackRedirectUrl,
  resolveAuthCallbackDestination,
  resolvePostAuthRedirect,
} from '@/features/auth/auth-redirect-utils';

describe('auth redirect utils', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://www.eternalrave.test';
    vi.stubGlobal('document', { title: 'test' });
  });

  it('builds web callback urls with safe returnTo', () => {
    expect(buildAuthCallbackRedirectUrl({ returnTo: '/profile' })).toBe(
      'https://www.eternalrave.test/auth/callback?returnTo=%2Fprofile',
    );
  });

  it('builds recovery callback urls with type=recovery', () => {
    expect(buildAuthCallbackRedirectUrl({ flow: 'recovery', returnTo: '/profile' })).toBe(
      'https://www.eternalrave.test/auth/callback?returnTo=%2Fprofile&type=recovery',
    );
  });

  it('rejects unsafe return routes in redirect urls', () => {
    expect(buildAuthCallbackRedirectUrl({ returnTo: '/login' })).toBe(
      `https://www.eternalrave.test${AUTH_CALLBACK_PATH}`,
    );
  });

  it('resolves post-auth destinations', () => {
    expect(resolvePostAuthRedirect('/create')).toBe('/create');
    expect(resolvePostAuthRedirect('/login')).toBe('/');
    expect(resolveAuthCallbackDestination('recovery', '/profile')).toBe('/reset-password');
    expect(resolveAuthCallbackDestination('signup', '/profile')).toBe('/profile');
  });
});
