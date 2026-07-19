import { Redirect, Stack, useSegments } from 'expo-router';
import { AdminAuthProvider, useAdminAuth } from '@/features/admin/AdminAuthContext';
import { AdminLoadingState } from '@/features/admin/components/AdminStates';

function AdminLayoutContent() {
  const { session, loading } = useAdminAuth();
  const segments = useSegments();
  const isLogin = segments[segments.length - 1] === 'login';

  if (loading) {
    return <AdminLoadingState label="Checking session…" />;
  }

  if (!session && !isLogin) {
    return <Redirect href="/admin/login" />;
  }

  if (session && isLogin) {
    return <Redirect href="/admin" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0B0B0F' },
      }}
    />
  );
}

export default function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminLayoutContent />
    </AdminAuthProvider>
  );
}
