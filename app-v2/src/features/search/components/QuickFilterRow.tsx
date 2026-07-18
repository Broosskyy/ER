import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';
import type { DateRangeFilter } from '@/features/search/constants';

export interface QuickFilterRowProps {
  dateRange: DateRangeFilter;
  activeFilterCount: number;
  onSelectDateRange: (dateRange: DateRangeFilter) => void;
  onOpenGenre: () => void;
  onOpenFilters: () => void;
}

export function QuickFilterRow({
  dateRange,
  activeFilterCount,
  onSelectDateRange,
  onOpenGenre,
  onOpenFilters,
}: QuickFilterRowProps) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <FilterChip
        label="Today"
        selected={dateRange === 'today'}
        onPress={() => onSelectDateRange('today')}
      />
      <FilterChip
        label="This Weekend"
        selected={dateRange === 'this-weekend'}
        onPress={() => onSelectDateRange('this-weekend')}
      />
      <FilterChip label="Genre" selected={false} onPress={onOpenGenre} />
      <Pressable
        accessibilityRole="button"
        onPress={onOpenFilters}
        style={({ pressed }) => [styles.filtersButton, pressed && styles.pressed]}
      >
        <AppText style={styles.filtersLabel}>Filters</AppText>
        {activeFilterCount > 0 ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{activeFilterCount}</AppText>
          </View>
        ) : null}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingRight: spacingRoles.screenHorizontal + spacing.lg,
    gap: spacingRoles.chipGap,
    paddingBottom: spacing.sm,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  filtersLabel: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...textRoles.badge,
    color: colors.textOnPrimary,
    fontSize: 10,
    lineHeight: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
