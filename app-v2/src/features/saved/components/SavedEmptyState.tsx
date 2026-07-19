import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SavedEmptyStateProps {
  onExploreEvents: () => void;
}

export function SavedEmptyState({ onExploreEvents }: SavedEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons
          name="heart-outline"
          size={componentSize.iconLg * 2}
          color={colorRoles.emptyStateIcon}
        />
      </View>
      <AppText style={styles.title}>No saved events yet</AppText>
      <AppText style={styles.description}>
        Save events you like and find them here later.
      </AppText>
      <PrimaryButton label="Explore events" onPress={onExploreEvents} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  iconWrap: {
    marginBottom: spacing.sm,
  },
  title: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
    color: colorRoles.emptyStateTitle,
  },
  description: {
    ...textRoles.metadata,
    textAlign: 'center',
    color: colorRoles.emptyStateDescription,
    marginBottom: spacing.md,
  },
  button: {
    minWidth: 200,
  },
});
