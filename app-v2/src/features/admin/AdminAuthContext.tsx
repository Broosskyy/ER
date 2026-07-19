import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getErrorMessage } from '@/core/errors/app-error';
import { canAccessAdmin } from '@/features/admin/admin-permissions';
import { listRoutePermissions } from '@/features/admin/admin-permissions';
import {
  resolveAdminRole,
  type AdminPermission,
  type AdminRole,
} from '@/features/import/admin/admin-roles';
import { authService, type AuthSession } from '@/services/supabase/auth-service';

interface AdminAuthContextValue {
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

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

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

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);

  const applyRoleState = useCallback((nextSession: AuthSession | null) => {
    const nextRoleState = resolveRoleState(nextSession);
    setRole(nextRoleState.role);
    setPermissions(nextRoleState.permissions);
    setRoleError(nextRoleState.roleError);
    setIsRoleLoading(false);
  }, []);

  const refreshRole = useCallback(() => {
    if (!session) {
      applyRoleState(null);
      return;
    }

    setIsRoleLoading(true);
    applyRoleState(session);
  }, [applyRoleState, session]);

  useEffect(() => {
    let active = true;

    authService
      .getSession()
      .then((nextSession) => {
        if (!active) {
          return;
        }

        setSession(nextSession);
        applyRoleState(nextSession);
      })
      .catch((cause) => {
        if (!active) {
          return;
        }

        setAuthError(getErrorMessage(cause));
        applyRoleState(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const unsubscribe = authService.onAuthStateChange((nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setIsRoleLoading(true);
      applyRoleState(nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyRoleState]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    setIsRoleLoading(true);
    const next = await authService.signIn(email, password);
    setSession(next);
    applyRoleState(next);
  }, [applyRoleState]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await authService.signOut();
    setSession(null);
    setRole(null);
    setPermissions([]);
    setRoleError(null);
    setIsRoleLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    setAuthError(null);
    setIsRoleLoading(true);
    const next = await authService.refreshSession();
    setSession(next);
    applyRoleState(next);
  }, [applyRoleState]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isLoading: loading,
      isAuthenticated: session !== null,
      authError,
      role,
      permissions,
      isRoleLoading,
      roleError,
      hasAdminAccess: canAccessAdmin(role),
      signIn,
      signOut,
      refreshSession,
      refreshRole,
      clearAuthError,
    }),
    [
      session,
      loading,
      authError,
      role,
      permissions,
      isRoleLoading,
      roleError,
      signIn,
      signOut,
      refreshSession,
      refreshRole,
      clearAuthError,
    ],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
