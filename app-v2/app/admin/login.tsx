import { Redirect, useLocalSearchParams } from 'expo-router';

import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { isSafeAdminReturnRoute } from '@/features/admin/admin-route-utils';

export default function AdminLoginRedirectScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const safeReturnTo = isSafeAdminReturnRoute(returnTo) ? returnTo : '/admin';

  return <Redirect href={buildLoginHref(safeReturnTo) as '/login'} />;
}
