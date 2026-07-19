import { useMemo } from 'react';

import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  hasPermission,
  resolveAdminRole,
  type AdminPermission,
  type AdminRole,
} from '@/features/import/admin/admin-roles';

export function useAdminRole() {
  const { session } = useAdminAuth();
  const role = useMemo(() => resolveAdminRole(session), [session]);

  return {
    session,
    role,
    can: (permission: AdminPermission) => hasPermission(role, permission),
  };
}

export type { AdminRole, AdminPermission };
