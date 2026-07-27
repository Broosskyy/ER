import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface FilterSummaryBarProps {
  summaries: string[];
  onClearAll?: () => void;
}

export function FilterSummaryBar({ summaries, onClearAll }: FilterSummaryBarProps) {
  const { t } = useAppTranslation();

  if (summaries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {summaries.map((summary) => (
          <View key={summary} style={styles.chip}>
            <AppText style={styles.chipText}>{summary}</AppText>
          </View>
        ))}
      </View>
      {onClearAll ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearAll}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText style={styles.clearAll}>{t('search.filters.clearAll')}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    fontWeight: '500',
  },
  clearAll: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
