import { Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { layout } from '@/design/layout';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';

export interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function PrimaryButton({ label, style, disabled = false, ...rest }: PrimaryButtonProps) {
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
      <AppText variant="body" color={colors.white} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    backgroundColor: colors.primaryHighlight,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontWeight: '600',
  },
});
