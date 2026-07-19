import { ScrollView, StyleSheet } from 'react-native';

import { spacing, spacingRoles } from '@/design/spacing';
import { FilterChip } from '@/features/home/components/FilterChip';
import { getActiveDateOptions } from '@/features/search/config/filter-config';
import type { DateRangeFilter } from '@/features/search/constants';

export interface ExploreTimeFilterRowProps {
  selectedId: DateRangeFilter;
  onSelect: (id: DateRangeFilter) => void;
}

export function ExploreTimeFilterRow({ selectedId, onSelect }: ExploreTimeFilterRowProps) {
  const options = getActiveDateOptions().filter((option) => option.id !== 'all-dates');

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {options.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          selected={selectedId === chip.id}
          onPress={() => onSelect(chip.id)}
        />
      ))}
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
});
