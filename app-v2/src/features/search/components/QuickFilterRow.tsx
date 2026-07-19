import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';
import { getQuickDateOptions } from '@/features/search/config/filter-config';
import type { DateRangeFilter } from '@/features/search/constants';

export interface QuickFilterRowProps {
  dateRange: DateRangeFilter;
  activeFilterCount: number;
  onSelectDateRange: (dateRange: DateRangeFilter) => void;
  onOpenFilters: () => void;
}

export function QuickFilterRow({
  dateRange,
  activeFilterCount,
  onSelectDateRange,
  onOpenFilters,
}: QuickFilterRowProps) {
  const quickDateOptions = getQuickDateOptions();

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {quickDateOptions.map((option) => (
        <FilterChip
          key={option.id}
          label={option.label}
          selected={dateRange === option.id}
          onPress={() => onSelectDateRange(option.id)}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={onOpenFilters}
        style={({ pressed }) => [styles.filtersButton, pressed && styles.pressed]}
      >
        <AppText style={styles.filtersLabel}>
          Filters{activeFilterCount > 0 ? ` • ${activeFilterCount}` : ''}
        </AppText>
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
  pressed: {
    opacity: 0.85,
  },
});
