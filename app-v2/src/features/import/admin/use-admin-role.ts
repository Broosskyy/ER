import { useMemo } from 'react';

import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  hasPermission,
  type AdminPermission,
  type AdminRole,
} from '@/features/import/admin/admin-roles';

export function useAdminRole() {
  const { session, role, permissions } = useAdminAuth();

  return {
    session,
    role,
    permissions,
    can: (permission: AdminPermission) => hasPermission(role, permission),
  };
}

export type { AdminRole, AdminPermission };
