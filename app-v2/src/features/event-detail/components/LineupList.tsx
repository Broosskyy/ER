import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface LineupListProps {
  artists: string[];
}

export function LineupList({ artists }: LineupListProps) {
  if (artists.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {artists.map((artist, index) => (
        <View key={`${artist}-${index}`} style={styles.item}>
          <AppText style={styles.bullet}>•</AppText>
          <AppText style={styles.artist}>{artist}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    ...textRoles.body,
    color: colorRoles.chipSelectedBackground,
    lineHeight: 22,
  },
  artist: {
    ...textRoles.body,
    flex: 1,
  },
});
