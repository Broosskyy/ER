import { describe, expect, it } from 'vitest';

import {
  canAccessAdmin,
  canDeleteEvents,
  canEditEvents,
  canManageSources,
  canModerateContributorEvents,
  canPublishEvents,
  canReviewImports,
  canViewContributorReviewQueue,
  canViewEvents,
  canViewImportJobs,
  canViewSources,
} from '@/features/admin/admin-permissions';
import { ADMIN_ROLES, hasPermission, resolveAdminRole } from '@/features/import/admin/admin-roles';
import type { AuthSession } from '@/services/supabase/auth-service';

function sessionWithRole(role: string): AuthSession {
  return {
    user: { id: 'user-1', email: 'user@test.com' },
    accessToken: 'token',
    role,
  };
}

describe('resolveAdminRole', () => {
  it('returns null without session', () => {
    expect(resolveAdminRole(null)).toBeNull();
  });

  it('returns null for unknown roles', () => {
    expect(resolveAdminRole(sessionWithRole('guest'))).toBeNull();
  });

  it.each(ADMIN_ROLES)('accepts known role %s', (role) => {
    expect(resolveAdminRole(sessionWithRole(role))).toBe(role);
  });
});

describe('admin permissions matrix', () => {
  it('viewer can access admin and view events but not edit', () => {
    const role = 'viewer' as const;
    expect(canAccessAdmin(role)).toBe(true);
    expect(canViewEvents(role)).toBe(true);
    expect(canEditEvents(role)).toBe(false);
    expect(canDeleteEvents(role)).toBe(false);
    expect(canPublishEvents(role)).toBe(false);
    expect(canViewSources(role)).toBe(true);
    expect(canManageSources(role)).toBe(false);
    expect(canViewImportJobs(role)).toBe(true);
    expect(canReviewImports(role)).toBe(true);
    expect(hasPermission(role, 'records:approve')).toBe(false);
  });

  it('editor can edit events but not publish', () => {
    const role = 'editor' as const;
    expect(canEditEvents(role)).toBe(true);
    expect(canPublishEvents(role)).toBe(false);
    expect(hasPermission(role, 'records:edit')).toBe(true);
  });

  it('reviewer can resolve import records', () => {
    const role = 'reviewer' as const;
    expect(hasPermission(role, 'records:approve')).toBe(true);
    expect(canEditEvents(role)).toBe(false);
  });

  it('source_manager can manage sources', () => {
    const role = 'source_manager' as const;
    expect(canManageSources(role)).toBe(true);
    expect(hasPermission(role, 'imports:start')).toBe(true);
  });

  it('admin and owner can publish events', () => {
    expect(canPublishEvents('admin')).toBe(true);
    expect(canPublishEvents('owner')).toBe(true);
    expect(canModerateContributorEvents('admin')).toBe(true);
    expect(canModerateContributorEvents('editor')).toBe(false);
    expect(canViewContributorReviewQueue('viewer')).toBe(true);
  });

  it('denies all permissions for null role', () => {
    expect(canAccessAdmin(null)).toBe(false);
    expect(canViewEvents(null)).toBe(false);
    expect(hasPermission(null, 'jobs:read')).toBe(false);
  });
});
