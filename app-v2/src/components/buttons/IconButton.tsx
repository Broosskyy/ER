import { ActivityIndicator, Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';

import {
  resolveIconButtonDimensions,
  resolveIconButtonStyle,
  type IconButtonSize,
} from './button-styles';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: AppIconName;
  size?: IconButtonSize;
  style?: ViewStyle;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
}

/** Round icon action — mockup 52 IconButton. */
export function IconButton({
  icon,
  size = 'md',
  style,
  accessibilityLabel,
  disabled = false,
  loading = false,
  destructive = false,
  ...rest
}: IconButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const dimensions = resolveIconButtonDimensions(size);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => {
        const resolved = resolveIconButtonStyle(theme, {
          pressed,
          disabled: isDisabled,
          destructive,
        });

        return [
          styles.button,
          {
            width: dimensions.buttonSize,
            height: dimensions.buttonSize,
            borderRadius: theme.radiusRoles.iconButton,
            backgroundColor: resolved.backgroundColor,
            opacity: resolved.opacity,
          },
          style,
        ];
      }}
      {...rest}
    >
      {({ pressed }) => {
        const resolved = resolveIconButtonStyle(theme, {
          pressed,
          disabled: isDisabled,
          destructive,
        });

        if (loading) {
          return <ActivityIndicator size="small" color={resolved.iconColor} />;
        }

        return <AppIcon name={icon} size={size} color={resolved.iconColor} />;
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
