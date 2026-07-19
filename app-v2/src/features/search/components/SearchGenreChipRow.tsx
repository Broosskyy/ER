import { ScrollView, StyleSheet } from 'react-native';

import { spacing, spacingRoles } from '@/design/spacing';
import { FilterChip } from '@/features/home/components/FilterChip';
import { SEARCH_GENRE_CHIPS, SearchGenreChipId } from '@/features/search/constants';

export interface SearchGenreChipRowProps {
  selectedId: SearchGenreChipId;
  onSelect: (id: SearchGenreChipId) => void;
}

export function SearchGenreChipRow({ selectedId, onSelect }: SearchGenreChipRowProps) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {SEARCH_GENRE_CHIPS.map((chip) => (
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
    paddingRight: spacingRoles.screenHorizontal + spacing.sm,
    gap: spacingRoles.chipGap,
    paddingBottom: spacing.md,
  },
});
