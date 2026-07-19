import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SavedHeaderProps {
  count: number;
}

function formatSavedCount(count: number): string {
  if (count === 1) {
    return '1 saved event';
  }

  return `${count} saved events`;
}

export function SavedHeader({ count }: SavedHeaderProps) {
  return (
    <View style={styles.container}>
      <AppText style={styles.title}>Saved</AppText>
      {count > 0 ? (
        <AppText style={styles.count}>{formatSavedCount(count)}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.sectionTitleGap,
    gap: 4,
  },
  title: {
    ...textRoles.screenTitle,
  },
  count: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
});
