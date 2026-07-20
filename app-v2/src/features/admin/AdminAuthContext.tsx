import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { canAccessAdmin } from '@/features/admin/admin-permissions';
import { listRoutePermissions } from '@/features/admin/admin-permissions';
import {
  resolveAdminRole,
  type AdminPermission,
  type AdminRole,
} from '@/features/import/admin/admin-roles';
import type { AuthSession } from '@/services/supabase/auth-service';

export interface AdminAuthContextValue {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  role: AdminRole | null;
  permissions: AdminPermission[];
  isRoleLoading: boolean;
  roleError: string | null;
  hasAdminAccess: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshRole: () => void;
  clearAuthError: () => void;
}

function resolveRoleState(session: AuthSession | null): {
  role: AdminRole | null;
  permissions: AdminPermission[];
  roleError: string | null;
} {
  if (!session) {
    return { role: null, permissions: [], roleError: null };
  }

  const role = resolveAdminRole(session);
  if (!role) {
    return {
      role: null,
      permissions: [],
      roleError: 'Your account does not have admin access.',
    };
  }

  return {
    role,
    permissions: listRoutePermissions(role),
    roleError: null,
  };
}

export function useAdminAuth(): AdminAuthContextValue {
  const auth = useAuth();
  const roleState = useMemo(() => resolveRoleState(auth.session), [auth.session]);

  return useMemo(
    () => ({
      session: auth.session,
      user: auth.user,
      loading: auth.loading,
      isLoading: auth.loading,
      isAuthenticated: auth.isAuthenticated,
      authError: auth.authError,
      role: roleState.role,
      permissions: roleState.permissions,
      isRoleLoading: auth.loading,
      roleError: roleState.roleError,
      hasAdminAccess: canAccessAdmin(roleState.role),
      signIn: auth.signIn,
      signOut: auth.signOut,
      refreshSession: auth.refreshSession,
      refreshRole: () => {
        void auth.refreshSession();
      },
      clearAuthError: auth.clearAuthError,
    }),
    [auth, roleState],
  );
}
