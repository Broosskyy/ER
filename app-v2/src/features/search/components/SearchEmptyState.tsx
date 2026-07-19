import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SearchEmptyStateProps {
  onClearAll: () => void;
  onAdjustFilters: () => void;
}

export function SearchEmptyState({ onClearAll, onAdjustFilters }: SearchEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons
          name="search-outline"
          size={componentSize.iconLg * 2}
          color={colorRoles.emptyStateIcon}
        />
      </View>
      <AppText style={styles.title}>No matching events</AppText>
      <AppText style={styles.description}>Try removing one or more filters.</AppText>
      <View style={styles.actions}>
        <PrimaryButton label="Clear All" onPress={onClearAll} style={styles.button} />
        <SecondaryButton label="Adjust Filters" onPress={onAdjustFilters} style={styles.button} />
      </View>
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
  actions: {
    width: '100%',
    gap: spacing.sm,
    alignItems: 'center',
  },
  button: {
    minWidth: 200,
  },
});
