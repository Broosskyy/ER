import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacingRoles } from '@/design/spacing';

export interface SavedHeaderProps {
  count: number;
}

function formatSavedCount(count: number): string {
  if (count === 1) {
    return '1 gespeichertes Event';
  }

  return `${count} gespeicherte Events`;
}

export function SavedHeader({ count }: SavedHeaderProps) {
  return (
    <View style={styles.container}>
      <AppText role="titleLarge">Gespeichert</AppText>
      {count > 0 ? <AppText role="bodyMuted">{formatSavedCount(count)}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacingRoles.sectionTitleGap,
    paddingBottom: spacingRoles.sectionTitleGap,
    gap: 4,
  },
});
