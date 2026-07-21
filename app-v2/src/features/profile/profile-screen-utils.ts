import { canAccessAdmin } from '@/features/admin/admin-permissions';
import { resolveAdminRole } from '@/features/import/admin/admin-roles';
import type { AuthSession } from '@/services/supabase/auth-service';

export const PROFILE_ADMIN_ROUTE = '/admin' as const;
export const PROFILE_SCROLL_TEST_ID = 'profile-scroll';

export function shouldShowProfileAdminLink(session: AuthSession | null): boolean {
  return canAccessAdmin(resolveAdminRole(session));
}

export function getProfileAdminHref(
  session: AuthSession | null,
): typeof PROFILE_ADMIN_ROUTE | null {
  return shouldShowProfileAdminLink(session) ? PROFILE_ADMIN_ROUTE : null;
}
