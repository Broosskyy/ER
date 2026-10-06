import { ScrollView, StyleSheet, ViewStyle } from 'react-native';

import { FilterChip } from '@/components/discovery/FilterChip';
import { spacing } from '@/design/spacing';

import type { ActiveFilterViewModel } from './view-models';

export interface ActiveFilterBarProps {
  filters: ActiveFilterViewModel[];
  onRemove?: (id: string) => void;
  onPress?: (id: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Active filter chips — mockups 09, 10, 13. */
export function ActiveFilterBar({
  filters,
  onRemove,
  onPress,
  style,
  testID,
}: ActiveFilterBarProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, style]}
      testID={testID}
      accessibilityRole="list"
    >
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          count={filter.count}
          selected
          removable={Boolean(onRemove)}
          onPress={() => onPress?.(filter.id)}
          onRemove={() => onRemove?.(filter.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
