import { ScrollView, StyleSheet, View } from 'react-native';

import {
  RecentSearchItem,
  SearchSectionHeader,
  SearchSuggestionItem,
  TrendingSearchItem,
} from '@/components/search/SearchItems';
import { spacing, spacingRoles } from '@/design/spacing';
import { getTrendingSearches } from '@/features/search/config/trending-searches';
import { useRecentSearches } from '@/features/search/hooks/use-recent-searches';
import type { DiscoverySearchSuggestion } from '@/features/search/feed/search-feed-types';

export interface SearchExplorePanelProps {
  suggestions?: DiscoverySearchSuggestion[];
  suggestionsLoading?: boolean;
  onSelectQuery: (query: string) => void;
  bottomInset?: number;
}

export function SearchExplorePanel({
  suggestions = [],
  suggestionsLoading = false,
  onSelectQuery,
  bottomInset = 0,
}: SearchExplorePanelProps) {
  const { items: recentSearches, remove } = useRecentSearches();
  const trendingSearches = getTrendingSearches();
  const showSuggestions = suggestions.length > 0 || suggestionsLoading;

  return (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      testID="search-explore-panel"
    >
      {showSuggestions ? (
        <View style={styles.section}>
          <SearchSectionHeader title="Vorschläge" />
          {suggestions.map((suggestion) => (
            <SearchSuggestionItem
              key={suggestion.id}
              suggestion={{
                id: suggestion.id,
                kind: suggestion.kind === 'query' ? 'event' : suggestion.kind,
                title: suggestion.title,
                subtitleLabel: suggestion.subtitle,
                accessibilityLabel: suggestion.title,
              }}
              onPress={() => onSelectQuery(suggestion.query)}
            />
          ))}
        </View>
      ) : null}

      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <SearchSectionHeader title="Letzte Suchen" count={recentSearches.length} />
          {recentSearches.map((item) => (
            <RecentSearchItem
              key={item.id}
              item={item}
              onPress={() => onSelectQuery(item.title)}
              onRemove={() => void remove(item.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SearchSectionHeader title="Trending" />
        {trendingSearches.map((item) => (
          <TrendingSearchItem
            key={item.id}
            item={item}
            onPress={() => onSelectQuery(item.title)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
});
