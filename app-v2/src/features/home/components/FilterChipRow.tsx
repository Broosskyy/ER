import { ScrollView, StyleSheet } from 'react-native';

import { spacing, spacingRoles } from '@/design/spacing';
import { HOME_FILTER_CHIPS, HomeFilterChipId } from '@/features/events/data/demo-events';

import { FilterChip } from './FilterChip';

export interface FilterChipRowProps {
  selectedId: HomeFilterChipId;
  onSelect: (id: HomeFilterChipId) => void;
}

export function FilterChipRow({ selectedId, onSelect }: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {HOME_FILTER_CHIPS.map((chip) => (
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
    gap: spacingRoles.chipGap,
    paddingBottom: spacing.md,
  },
});
