import type { AuthSession } from '@/services/supabase/auth-service';
import { ImportPermissionError } from '@/features/import/errors/import-errors';

export const ADMIN_ROLES = [
  'viewer',
  'editor',
  'reviewer',
  'source_manager',
  'admin',
  'owner',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminPermission =
  | 'sources:read'
  | 'sources:write'
  | 'sources:test'
  | 'imports:start'
  | 'jobs:read'
  | 'records:read'
  | 'records:edit'
  | 'records:approve'
  | 'records:reject'
  | 'records:duplicate'
  | 'logs:read'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  viewer: ['sources:read', 'jobs:read', 'records:read', 'logs:read', 'audit:read'],
  editor: ['sources:read', 'jobs:read', 'records:read', 'records:edit', 'logs:read', 'audit:read'],
  reviewer: [
    'sources:read',
    'jobs:read',
    'records:read',
    'records:edit',
    'records:approve',
    'records:reject',
    'records:duplicate',
    'logs:read',
    'audit:read',
  ],
  source_manager: [
    'sources:read',
    'sources:write',
    'sources:test',
    'imports:start',
    'jobs:read',
    'records:read',
    'logs:read',
    'audit:read',
  ],
  admin: [
    'sources:read',
    'sources:write',
    'sources:test',
    'imports:start',
    'jobs:read',
    'records:read',
    'records:edit',
    'records:approve',
    'records:reject',
    'records:duplicate',
    'logs:read',
    'audit:read',
  ],
  owner: [
    'sources:read',
    'sources:write',
    'sources:test',
    'imports:start',
    'jobs:read',
    'records:read',
    'records:edit',
    'records:approve',
    'records:reject',
    'records:duplicate',
    'logs:read',
    'audit:read',
  ],
};

export function resolveAdminRole(session: AuthSession | null): AdminRole {
  if (!session) return 'viewer';
  if (session.user.email === 'admin@eternalrave.app') return 'owner';
  const role = session.role;
  if (role && (ADMIN_ROLES as readonly string[]).includes(role)) {
    return role as AdminRole;
  }
  return 'admin';
}

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: AdminRole, permission: AdminPermission): void {
  if (!hasPermission(role, permission)) {
    throw new ImportPermissionError();
  }
}
