import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface EventGenreChipsProps {
  genres: string[];
}

export function EventGenreChips({ genres }: EventGenreChipsProps) {
  if (genres.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {genres.map((genre) => (
        <View key={genre} style={styles.chip}>
          <AppText style={styles.chipText}>{genre}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colorRoles.tagBackground,
    borderRadius: radiusRoles.chip,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...textRoles.chip,
  },
});
