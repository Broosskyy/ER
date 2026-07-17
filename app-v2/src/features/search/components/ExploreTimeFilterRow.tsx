import { ScrollView, StyleSheet } from 'react-native';

import { spacing, spacingRoles } from '@/design/spacing';
import { FilterChip } from '@/features/home/components/FilterChip';
import { EXPLORE_TIME_FILTERS, ExploreTimeFilterId } from '@/features/search/constants';

export interface ExploreTimeFilterRowProps {
  selectedId: ExploreTimeFilterId;
  onSelect: (id: ExploreTimeFilterId) => void;
}

export function ExploreTimeFilterRow({ selectedId, onSelect }: ExploreTimeFilterRowProps) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {EXPLORE_TIME_FILTERS.map((chip) => (
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
