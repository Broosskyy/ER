import { Redirect, Slot, useSegments } from 'expo-router';
import { Platform } from 'react-native';

import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { useAdminGuard } from '@/features/admin/admin-guard';
import { buildAdminLoginHref } from '@/features/admin/admin-route-utils';
import { AdminForbiddenState } from '@/features/admin/components/AdminForbidden';
import { AdminShell } from '@/features/admin/components/AdminShell';
import { AdminLoadingState } from '@/features/admin/components/AdminStates';
import { AdminWebOnlyState } from '@/features/admin/components/AdminWebOnly';

function AdminLayoutContent() {
  const segments = useSegments();
  const guard = useAdminGuard(segments);
  const { isAuthenticated, hasAdminAccess } = useAdminAuth();

  if (Platform.OS !== 'web') {
    return <AdminWebOnlyState />;
  }

  if (guard.state === 'auth-loading' || guard.state === 'role-loading') {
    return (
      <AdminLoadingState
        label={guard.state === 'auth-loading' ? 'Checking session…' : 'Loading permissions…'}
      />
    );
  }

  if (guard.isLoginRoute) {
    if (isAuthenticated && hasAdminAccess) {
      return <Redirect href="/admin" />;
    }

    return <Slot />;
  }

  if (guard.state === 'unauthenticated') {
    const returnTo = `/${segments.join('/')}`;
    return <Redirect href={buildAdminLoginHref(returnTo) as '/login'} />;
  }

  if (guard.state === 'forbidden' || guard.state === 'route-forbidden') {
    return (
      <AdminForbiddenState
        title={guard.state === 'route-forbidden' ? 'Route not allowed' : 'Access denied'}
        message={
          guard.state === 'route-forbidden'
            ? 'Your role does not include access to this admin route.'
            : undefined
        }
      />
    );
  }

  return (
    <AdminShell>
      <Slot />
    </AdminShell>
  );
}

export default function AdminLayout() {
  return <AdminLayoutContent />;
}
