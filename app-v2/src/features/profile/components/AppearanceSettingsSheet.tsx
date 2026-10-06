import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/overlay/BottomSheet';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import type { ThemeModePreference } from '@/design/theme/types';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface AppearanceSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: ThemeModePreference[] = ['light', 'dark', 'system'];

export function AppearanceSettingsSheet({ visible, onClose }: AppearanceSettingsSheetProps) {
  const { theme, mode, setMode } = useTheme();
  const { t } = useAppTranslation();

  const handleSelect = (nextMode: ThemeModePreference) => {
    setMode(nextMode);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('profile.settings.title')}
      onClose={onClose}
      testID="profile-appearance-settings-sheet"
    >
      <View style={styles.section}>
        <AppText role="label" color={theme.colors.textSecondary}>
          {t('profile.settings.appearance')}
        </AppText>
        <View style={styles.options} accessibilityRole="radiogroup">
          {THEME_OPTIONS.map((option) => {
            const selected = mode === option;

            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(`profile.settings.theme.${option}`)}
                onPress={() => handleSelect(option)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: selected ? theme.colors.accent : theme.colors.borderSubtle,
                    backgroundColor: selected ? theme.colors.accentMuted : theme.colors.surface,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                testID={`profile-theme-option-${option}`}
              >
                <AppText role={selected ? 'bodyStrong' : 'body'}>
                  {t(`profile.settings.theme.${option}`)}
                </AppText>
                {selected ? (
                  <AppIcon name="checkmark" size="sm" color={theme.colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: borderWidth.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
