import { ScrollView, StyleSheet, ViewStyle } from 'react-native';

import { CategoryChip } from '@/components/discovery/CategoryChip';
import { ActiveFilterBar } from '@/components/search/ActiveFilterBar';
import { spacing } from '@/design/spacing';

import type { ActiveFilterViewModel } from '@/components/search/view-models';
import type { SavedFilterViewModel } from './view-models';

export interface SavedFilterBarProps {
  filters: SavedFilterViewModel[];
  activeFilters?: ActiveFilterViewModel[];
  onSelect?: (id: SavedFilterViewModel['id']) => void;
  onRemoveActive?: (id: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 14 saved filter chips — reuses discovery and search chips. */
export function SavedFilterBar({
  filters,
  activeFilters = [],
  onSelect,
  onRemoveActive,
  style,
  testID,
}: SavedFilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, style]}
      testID={testID}
    >
      {filters.map((filter) => (
        <CategoryChip
          key={filter.id}
          label={filter.count !== undefined ? `${filter.label} (${filter.count})` : filter.label}
          selected={filter.selected}
          onPress={() => onSelect?.(filter.id)}
        />
      ))}
      {activeFilters.length > 0 ? (
        <ActiveFilterBar filters={activeFilters} onRemove={onRemoveActive} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
