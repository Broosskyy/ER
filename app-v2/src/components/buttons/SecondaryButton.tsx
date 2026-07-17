import { Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { layout } from '@/design/layout';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';

export interface SecondaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function SecondaryButton({ label, style, disabled = false, ...rest }: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <AppText variant="body" color={colors.textPrimary} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget,
    borderRadius: radii.md,
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontWeight: '600',
  },
});
