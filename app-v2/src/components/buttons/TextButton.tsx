import { ActivityIndicator, Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';

import {
  resolveTextButtonStyle,
  textButtonMetrics,
  type TextButtonVariant,
} from './text-button-styles';

export interface TextButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: TextButtonVariant;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * Text-only action control — mockup 52 (TextButton / LinkButton).
 * Min touch target 44px; no border fill.
 */
export function TextButton({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  ...rest
}: TextButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed, hovered }) => {
        const resolved = resolveTextButtonStyle(theme, {
          variant,
          pressed,
          hovered: Boolean(hovered),
          disabled: isDisabled,
        });

        return [
          styles.button,
          {
            backgroundColor: resolved.backgroundColor,
            opacity: resolved.opacity,
          },
          style,
        ];
      }}
      {...rest}
    >
      {({ pressed, hovered }) => {
        const resolved = resolveTextButtonStyle(theme, {
          variant,
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
    minHeight: textButtonMetrics.minHeight,
    minWidth: textButtonMetrics.minHeight,
    paddingHorizontal: textButtonMetrics.paddingHorizontal,
    paddingVertical: textButtonMetrics.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
