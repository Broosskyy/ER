import { describe, expect, it } from 'vitest';

import {
  buildLoginHref,
  buildRegisterHref,
  getCreateAuthLinks,
  getProfileAuthLinks,
  isSafeReturnRoute,
  resolveProfileAuthView,
} from '@/features/auth/auth-route-utils';

describe('auth route utils', () => {
  it('accepts safe internal return routes', () => {
    expect(isSafeReturnRoute('/')).toBe(true);
    expect(isSafeReturnRoute('/profile')).toBe(true);
    expect(isSafeReturnRoute('/create')).toBe(true);
    expect(isSafeReturnRoute('/admin/events')).toBe(true);
    expect(isSafeReturnRoute('/admin/imports/review/abc')).toBe(true);
  });

  it('rejects external and auth return routes', () => {
    expect(isSafeReturnRoute('https://evil.test/admin')).toBe(false);
    expect(isSafeReturnRoute('//evil.test/admin')).toBe(false);
    expect(isSafeReturnRoute('/login')).toBe(false);
    expect(isSafeReturnRoute('/register')).toBe(false);
    expect(isSafeReturnRoute('/admin/login')).toBe(false);
    expect(isSafeReturnRoute('/auth/callback')).toBe(false);
    expect(isSafeReturnRoute('/forgot-password')).toBe(false);
    expect(isSafeReturnRoute('/reset-password')).toBe(false);
    expect(isSafeReturnRoute('/login?returnTo=%2Fadmin')).toBe(false);
    expect(isSafeReturnRoute('/register?returnTo=%2Fprofile')).toBe(false);
  });

  it('builds login href with encoded return route', () => {
    expect(buildLoginHref('/admin/events')).toBe('/login?returnTo=%2Fadmin%2Fevents');
    expect(buildLoginHref('https://evil.test')).toBe('/login');
  });

  it('builds register href with encoded return route', () => {
    expect(buildRegisterHref('/profile')).toBe('/register?returnTo=%2Fprofile');
    expect(buildRegisterHref('/register')).toBe('/register');
  });

  it('builds profile auth links with profile return route', () => {
    expect(getProfileAuthLinks()).toEqual({
      loginHref: '/login?returnTo=%2Fprofile',
      registerHref: '/register?returnTo=%2Fprofile',
    });
  });

  it('builds create auth links with create return route', () => {
    expect(getCreateAuthLinks()).toEqual({
      loginHref: '/login?returnTo=%2Fcreate',
      registerHref: '/register?returnTo=%2Fcreate',
    });
  });

  it('resolves profile auth view from authentication state', () => {
    expect(resolveProfileAuthView(false)).toBe('signed-out');
    expect(resolveProfileAuthView(true)).toBe('signed-in');
  });
});
