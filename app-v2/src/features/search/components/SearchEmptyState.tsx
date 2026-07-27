import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface SearchEmptyStateProps {
  onClearAll: () => void;
  onAdjustFilters: () => void;
}

export function SearchEmptyState({ onClearAll, onAdjustFilters }: SearchEmptyStateProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons
          name="search-outline"
          size={componentSize.iconLg * 2}
          color={colorRoles.emptyStateIcon}
        />
      </View>
      <AppText style={styles.title}>{t('search.empty.title')}</AppText>
      <AppText style={styles.description}>{t('search.empty.description')}</AppText>
      <View style={styles.actions}>
        <PrimaryButton label={t('search.empty.clearAll')} onPress={onClearAll} style={styles.button} />
        <SecondaryButton
          label={t('search.empty.adjustFilters')}
          onPress={onAdjustFilters}
          style={styles.button}
        />
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
