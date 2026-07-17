import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SearchEmptyStateProps {
  onClearFilters: () => void;
}

export function SearchEmptyState({ onClearFilters }: SearchEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons
          name="search-outline"
          size={componentSize.iconLg * 2}
          color={colorRoles.emptyStateIcon}
        />
      </View>
      <AppText style={styles.title}>No events found</AppText>
      <AppText style={styles.description}>Try another search or change the filters.</AppText>
      <SecondaryButton label="Clear Filters" onPress={onClearFilters} style={styles.button} />
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
    minWidth: 180,
  },
});
