import { useMemo } from 'react';

import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { canAccessAdminRoute } from '@/features/admin/admin-permissions';
import {
  resolveAdminRouteKey,
  type AdminRouteKey,
} from '@/features/admin/admin-route-utils';
import type { AdminRole } from '@/features/import/admin/admin-roles';

export type AdminGuardState =
  | 'auth-loading'
  | 'unauthenticated'
  | 'role-loading'
  | 'forbidden'
  | 'route-forbidden'
  | 'ready';

export interface AdminGuardResult {
  state: AdminGuardState;
  routeKey: AdminRouteKey;
  isLoginRoute: boolean;
}

export function evaluateAdminGuard(input: {
  segments: string[];
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isRoleLoading: boolean;
  role: AdminRole | null;
  hasAdminAccess: boolean;
}): AdminGuardResult {
  const routeKey = resolveAdminRouteKey(input.segments);
  const isLoginRoute = input.segments[input.segments.length - 1] === 'login';

  if (isLoginRoute) {
    return { state: 'ready', routeKey, isLoginRoute: true };
  }

  if (input.isAuthLoading) {
    return { state: 'auth-loading', routeKey, isLoginRoute: false };
  }

  if (!input.isAuthenticated) {
    return { state: 'unauthenticated', routeKey, isLoginRoute: false };
  }

  if (input.isRoleLoading) {
    return { state: 'role-loading', routeKey, isLoginRoute: false };
  }

  if (!input.hasAdminAccess) {
    return { state: 'forbidden', routeKey, isLoginRoute: false };
  }

  if (!canAccessAdminRoute(routeKey, input.role)) {
    return { state: 'route-forbidden', routeKey, isLoginRoute: false };
  }

  return { state: 'ready', routeKey, isLoginRoute: false };
}

export function useAdminGuard(segments: string[]): AdminGuardResult {
  const { isAuthenticated, isLoading, isRoleLoading, role, hasAdminAccess } = useAdminAuth();

  return useMemo(
    () =>
      evaluateAdminGuard({
        segments,
        isAuthenticated,
        isAuthLoading: isLoading,
        isRoleLoading,
        role,
        hasAdminAccess,
      }),
    [segments, isAuthenticated, isLoading, isRoleLoading, role, hasAdminAccess],
  );
}
