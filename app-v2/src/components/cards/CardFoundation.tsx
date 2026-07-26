import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';
import { spacingRoles } from '@/design/spacing';
import type { SpacingToken } from '@/design/spacing';

import { cardMetrics, resolveCardStyle } from './card-styles';

export interface CardFoundationProps {
  children: ReactNode;
  elevated?: boolean;
  padding?: SpacingToken | false;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Neutral card foundation — mockup 54 base without domain content.
 */
export function CardFoundation({
  children,
  elevated = false,
  padding = 'lg',
  onPress,
  disabled = false,
  style,
  testID,
}: CardFoundationProps) {
  const { theme } = useTheme();
  const paddingValue = padding === false ? 0 : theme.spacing[padding];
  const isDisabled = disabled;

  const content = (pressed = false) => {
    const resolved = resolveCardStyle(theme, {
      elevated,
      pressed,
      disabled: isDisabled,
    });

    return (
      <View
        testID={testID}
        style={[
          styles.card,
          {
            backgroundColor: resolved.backgroundColor,
            borderColor: resolved.borderColor,
            borderRadius: theme.radiusRoles.card,
            padding: paddingValue,
            opacity: resolved.opacity,
          },
          elevated && theme.shadows.card,
          style,
        ]}
      >
        {children}
      </View>
    );
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
      >
        {({ pressed }) => content(pressed)}
      </Pressable>
    );
  }

  return content(false);
}

/** Alias for neutral card foundation. */
export const Card = CardFoundation;

const styles = StyleSheet.create({
  card: {
    borderWidth: cardMetrics.borderWidth,
    gap: spacingRoles.cardContentGap,
  },
});
