import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { componentSize, layout } from '@/design/layout';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { fontSize, textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export function CreateHeaderButton() {
  const router = useRouter();
  const { t } = useAppTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.header.createA11y')}
      onPress={() => router.push('/create')}
      style={({ pressed, hovered }) => [
        styles.button,
        (pressed || hovered) && styles.pressed,
      ]}
      testID="home-create-button"
    >
      <AppText style={styles.label}>{t('home.header.create')}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget,
    minWidth: componentSize.iconButtonSize,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
  label: {
    ...textRoles.metadata,
    color: colors.textOnPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
