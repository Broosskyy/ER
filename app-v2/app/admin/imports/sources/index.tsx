import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function LegacyImportSourcesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/sources' as '/admin');
  }, [router]);

  return null;
}
