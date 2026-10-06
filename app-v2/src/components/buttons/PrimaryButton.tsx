import { ActivityIndicator, Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';

import { filledButtonMetrics, resolveFilledButtonStyle } from './button-styles';

export interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
}

/** Consumer CTA — mockup 52 PrimaryButton. */
export function PrimaryButton({
  label,
  style,
  disabled = false,
  loading = false,
  ...rest
}: PrimaryButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed, hovered }) => {
        const resolved = resolveFilledButtonStyle(theme, {
          variant: 'primary',
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
            opacity: resolved.opacity,
          },
          style,
        ];
      }}
      {...rest}
    >
      {({ pressed, hovered }) => {
        const resolved = resolveFilledButtonStyle(theme, {
          variant: 'primary',
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
  },
});
