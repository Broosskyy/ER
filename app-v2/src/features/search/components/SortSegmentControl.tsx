import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { fontSize } from '@/design/typography';
import { SEARCH_SORT_OPTIONS, SearchSortOption } from '@/features/search/constants';

export interface SortSegmentControlProps {
  selected: SearchSortOption;
  onSelect: (value: SearchSortOption) => void;
}

export function SortSegmentControl({ selected, onSelect }: SortSegmentControlProps) {
  return (
    <View style={styles.container}>
      {SEARCH_SORT_OPTIONS.map((option) => {
        const isSelected = option.id === selected;

        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
          >
            <AppText style={isSelected ? styles.labelSelected : styles.label} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderRadius: radiusRoles.searchField,
    backgroundColor: colorRoles.chipBackground,
    borderWidth: 1,
    borderColor: colorRoles.chipBorder,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusRoles.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
