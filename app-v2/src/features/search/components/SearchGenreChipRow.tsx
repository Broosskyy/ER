import { ScrollView, StyleSheet } from 'react-native';

import { spacing, spacingRoles } from '@/design/spacing';
import { FilterChip } from '@/features/home/components/FilterChip';
import { getActiveGenreOptions } from '@/features/search/config/filter-config';
import type { GenreFilterId } from '@/features/search/config/filter-config.types';

export interface SearchGenreChipRowProps {
  selectedIds: GenreFilterId[];
  onToggle: (id: GenreFilterId) => void;
}

export function SearchGenreChipRow({ selectedIds, onToggle }: SearchGenreChipRowProps) {
  const options = getActiveGenreOptions();

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
          selected={selectedIds.includes(chip.id)}
          onPress={() => onToggle(chip.id)}
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
