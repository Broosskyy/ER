import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';
import { spacingRoles } from '@/design/spacing';

import { resolveSurfaceStyle, type SurfaceVariant } from './surface-styles';

export interface SurfaceProps {
  children: ReactNode;
  variant?: SurfaceVariant;
  /** @deprecated Use variant="elevated" */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Theme-aware surface container without card chrome semantics.
 */
export function Surface({
  children,
  variant,
  elevated = false,
  style,
  testID,
}: SurfaceProps) {
  const { theme } = useTheme();
  const resolvedVariant = variant ?? (elevated ? 'elevated' : 'default');
  const resolved = resolveSurfaceStyle(theme, resolvedVariant);

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
        {
          backgroundColor: resolved.backgroundColor,
          borderColor: resolved.borderColor,
          borderWidth: resolved.borderWidth,
          borderRadius: theme.radiusRoles.card,
        },
        resolvedVariant === 'elevated' && theme.shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    padding: spacingRoles.cardPadding,
  },
});
