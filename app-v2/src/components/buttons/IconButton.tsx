import { Ionicons } from '@expo/vector-icons';
import { Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { colors } from '@/design/colors';
import { layout } from '@/design/layout';
import { radii } from '@/design/radii';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  style?: ViewStyle;
  accessibilityLabel: string;
}

export function IconButton({
  icon,
  size = 22,
  color = colors.textPrimary,
  style,
  accessibilityLabel,
  disabled = false,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
  disabled: {
    opacity: 0.5,
  },
});
