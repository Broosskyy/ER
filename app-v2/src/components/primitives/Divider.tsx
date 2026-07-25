import { StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';
import { borderWidth } from '@/design/radii';
import type { SpacingToken } from '@/design/spacing';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Inset applied to both ends along the divider axis */
  inset?: SpacingToken;
  style?: StyleProp<ViewStyle>;
}

/**
 * Theme-aware hairline divider — mockup spec: hairline borders, spacing over weight.
 */
export function Divider({
  orientation = 'horizontal',
  inset,
  style,
}: DividerProps) {
  const { theme } = useTheme();
  const insetValue = inset ? theme.spacing[inset] : 0;

  const baseStyle: ViewStyle =
    orientation === 'horizontal'
      ? {
          height: borderWidth.hairline,
          alignSelf: 'stretch',
          marginHorizontal: insetValue,
          backgroundColor: theme.colors.borderSubtle,
        }
      : {
          width: borderWidth.hairline,
          alignSelf: 'stretch',
          marginVertical: insetValue,
          backgroundColor: theme.colors.borderSubtle,
        };

  return <View style={[baseStyle, style]} accessibilityRole="none" />;
}
