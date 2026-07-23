import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function LegacyImportSourceDetailRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      router.replace(`/admin/sources/${id}` as '/admin/events/1');
    } else {
      router.replace('/admin/sources' as '/admin');
    }
  }, [id, router]);

  return null;
}
