import { View } from 'react-native';

import { useTheme } from '@/design/theme';
import type { SpacingToken } from '@/design/spacing';

export interface SpacerProps {
  size: SpacingToken;
  axis?: 'vertical' | 'horizontal';
}

/**
 * Token-only spacing primitive. Never pass raw pixel values.
 */
export function Spacer({ size, axis = 'vertical' }: SpacerProps) {
  const { theme } = useTheme();
  const value = theme.spacing[size];

  return (
    <View
      style={
        axis === 'horizontal'
          ? { width: value, height: 1 }
          : { height: value, width: 1 }
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
