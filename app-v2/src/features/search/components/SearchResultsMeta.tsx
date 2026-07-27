import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface SearchResultsMetaProps {
  count: number;
  summary?: string;
  onClear?: () => void;
}

export function SearchResultsMeta({ count, summary, onClear }: SearchResultsMetaProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.textWrap}>
        <AppText style={styles.count}>
          {count} {count === 1 ? t('search.results.singular') : t('search.results.plural')}
        </AppText>
        {summary ? <AppText style={styles.summary}>{summary}</AppText> : null}
      </View>
      {onClear ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText style={styles.clear}>{t('search.results.clearAll')}</AppText>
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
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  count: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    fontWeight: '600',
  },
  summary: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  clear: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
