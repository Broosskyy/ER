import { ActivityIndicator, Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { borderWidth } from '@/design/radii';
import { useTheme } from '@/design/theme';

import { filledButtonMetrics, resolveFilledButtonStyle } from './button-styles';

export interface SecondaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
}

/** Outline secondary action — mockup 52 SecondaryButton. */
export function SecondaryButton({
  label,
  style,
  disabled = false,
  loading = false,
  ...rest
}: SecondaryButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed, hovered }) => {
        const resolved = resolveFilledButtonStyle(theme, {
          variant: 'secondary',
          pressed,
          hovered: Boolean(hovered),
          disabled: isDisabled,
        });

        return [
          styles.button,
          {
            minHeight: filledButtonMetrics.minHeight,
            borderRadius: theme.radiusRoles.button,
            backgroundColor: resolved.backgroundColor,
            borderColor: resolved.borderColor,
            opacity: resolved.opacity,
          },
          style,
        ];
      }}
      {...rest}
    >
      {({ pressed, hovered }) => {
        const resolved = resolveFilledButtonStyle(theme, {
          variant: 'secondary',
          pressed,
          hovered: Boolean(hovered),
          disabled: isDisabled,
        });

        if (loading) {
          return <ActivityIndicator size="small" color={resolved.labelColor} />;
        }

        return (
          <AppText role="button" color={resolved.labelColor}>
            {label}
          </AppText>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: filledButtonMetrics.paddingHorizontal,
    paddingVertical: filledButtonMetrics.paddingVertical,
    borderWidth: borderWidth.hairline,
  },
});
