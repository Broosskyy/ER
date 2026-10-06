import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { IconButton } from '@/components/buttons/IconButton';
import { useSearchFilters } from '@/features/search/SearchContext';

/** Compact header search trigger — navigates to Events tab and focuses search. */
export function HomeHeaderSearchButton() {
  const router = useRouter();
  const { requestSearchFocus } = useSearchFilters();

  const openSearch = useCallback(() => {
    requestSearchFocus();
    router.push('/(tabs)/search');
  }, [requestSearchFocus, router]);

  return (
    <IconButton
      icon="search-outline"
      size="sm"
      accessibilityLabel="Search events"
      onPress={openSearch}
      testID="home-header-search-button"
    />
  );
}
