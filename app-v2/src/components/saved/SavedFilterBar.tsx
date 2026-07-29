import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { useTheme } from '@/design/theme';

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

/** Saved segment control — compact tabs, not oversized cards. */
export function SavedFilterBar({
  filters,
  onSelect,
  style,
  testID,
}: SavedFilterBarProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.root, { borderBottomColor: theme.colors.borderSubtle }, style]}
      accessibilityRole="tablist"
      testID={testID}
    >
      {filters.map((filter) => {
        const selected = Boolean(filter.selected);
        const label =
          filter.count !== undefined ? `${filter.label} (${filter.count})` : filter.label;

        return (
          <Pressable
            key={filter.id}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onSelect?.(filter.id)}
            style={[
              styles.tab,
              { borderBottomColor: selected ? theme.colors.accent : 'transparent' },
            ]}
          >
            <AppText
              role="label"
              numberOfLines={1}
              color={selected ? theme.colors.accent : theme.colors.textSecondary}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacingRoles.screenHorizontal,
    minHeight: 44,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
  },
});
