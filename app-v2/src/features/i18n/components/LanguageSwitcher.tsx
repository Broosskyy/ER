import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { changeAppLocale } from '@/features/i18n/i18n';
import type { AppLocale } from '@/features/i18n/locale';
import { useAppLocale, useAppTranslation } from '@/features/i18n/useAppTranslation';

const LANGUAGE_OPTIONS: Array<{
  locale: AppLocale;
  labelKey: 'common.language.german' | 'common.language.english';
}> = [
  { locale: 'de', labelKey: 'common.language.german' },
  { locale: 'en', labelKey: 'common.language.english' },
];

export function LanguageSwitcher() {
  const { t } = useAppTranslation();
  const currentLocale = useAppLocale();

  return (
    <View style={styles.container} testID="language-switcher">
      <AppText style={styles.title}>{t('common.language.title')}</AppText>
      <View style={styles.options}>
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = currentLocale === option.locale;
          return (
            <Pressable
              key={option.locale}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(option.labelKey)}
              onPress={() => {
                void changeAppLocale(option.locale);
              }}
              style={({ pressed, hovered }) => [
                styles.option,
                selected && styles.optionSelected,
                (pressed || hovered) && styles.optionPressed,
              ]}
            >
              <AppText
                style={
                  selected
                    ? { ...styles.optionLabel, ...styles.optionLabelSelected }
                    : styles.optionLabel
                }
              >
                {t(option.labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  options: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  optionPressed: {
    opacity: 0.9,
  },
  optionLabel: {
    ...textRoles.metadata,
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
