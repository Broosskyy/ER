import { describe, expect, it } from 'vitest';

import { evaluateAdminGuard } from '@/features/admin/admin-guard';
import {
  buildAdminLoginHref,
  isSafeAdminReturnRoute,
  resolveAdminRouteKey,
} from '@/features/admin/admin-route-utils';

describe('admin route utils', () => {
  it('accepts safe internal admin return routes', () => {
    expect(isSafeAdminReturnRoute('/admin/events')).toBe(true);
    expect(isSafeAdminReturnRoute('/admin/imports/review/abc')).toBe(true);
  });

  it('rejects external and login return routes', () => {
    expect(isSafeAdminReturnRoute('https://evil.test/admin')).toBe(false);
    expect(isSafeAdminReturnRoute('//evil.test/admin')).toBe(false);
    expect(isSafeAdminReturnRoute('/admin/login')).toBe(false);
    expect(isSafeAdminReturnRoute('/')).toBe(false);
  });

  it('builds login href with encoded return route', () => {
    expect(buildAdminLoginHref('/admin/events')).toBe('/login?returnTo=%2Fadmin%2Fevents');
    expect(buildAdminLoginHref('https://evil.test')).toBe('/login?returnTo=%2Fadmin');
  });

  it('resolves nested admin routes', () => {
    expect(resolveAdminRouteKey(['admin', 'imports', 'jobs', 'job-1'])).toBe('job-detail');
    expect(resolveAdminRouteKey(['admin', 'imports', 'review'])).toBe('review');
    expect(resolveAdminRouteKey(['admin', 'events'])).toBe('events');
  });
});

describe('evaluateAdminGuard', () => {
  const base = {
    isAuthenticated: true,
    isAuthLoading: false,
    isRoleLoading: false,
    role: 'admin' as const,
    hasAdminAccess: true,
  };

  it('allows login route while auth is loading', () => {
    expect(
      evaluateAdminGuard({
        ...base,
        segments: ['admin', 'login'],
        isAuthLoading: true,
        isAuthenticated: false,
      }).state,
    ).toBe('ready');
  });

  it('blocks protected routes without session', () => {
    expect(
      evaluateAdminGuard({
        ...base,
        segments: ['admin'],
        isAuthenticated: false,
        hasAdminAccess: false,
        role: null,
      }).state,
    ).toBe('unauthenticated');
  });

  it('blocks users without admin role', () => {
    expect(
      evaluateAdminGuard({
        ...base,
        segments: ['admin'],
        role: null,
        hasAdminAccess: false,
      }).state,
    ).toBe('forbidden');
  });

  it('blocks route-specific access for viewer on settings', () => {
    expect(
      evaluateAdminGuard({
        ...base,
        segments: ['admin', 'settings'],
        role: 'viewer',
      }).state,
    ).toBe('route-forbidden');
  });

  it('allows viewer on events route', () => {
    expect(
      evaluateAdminGuard({
        ...base,
        segments: ['admin', 'events'],
        role: 'viewer',
      }).state,
    ).toBe('ready');
  });
});
