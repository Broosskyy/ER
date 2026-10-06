import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SearchBar } from '@/components/inputs/SearchBar';
import { spacingRoles } from '@/design/spacing';
import { useSearchFilters } from '@/features/search/SearchContext';

/**
 * Home search entry — displays shared query state and routes to the Events tab.
 * Search execution stays on the Events screen (existing product flow).
 */
export function HomeSearchEntry() {
  const router = useRouter();
  const { filters, requestSearchFocus } = useSearchFilters();

  const openSearch = useCallback(() => {
    requestSearchFocus();
    router.push('/(tabs)/search');
  }, [requestSearchFocus, router]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search events"
      onPress={openSearch}
      style={styles.container}
      testID="home-search-entry"
    >
      <View pointerEvents="none">
        <SearchBar
          value={filters.query}
          placeholder="Events, Clubs, Künstler suchen"
          disabled
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacingRoles.sectionTitleGap,
  },
});
