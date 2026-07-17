import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '@/design/colors';
import { radii } from '@/design/radii';
import { shadows } from '@/design/shadows';
import { spacing } from '@/design/spacing';

export interface SurfaceCardProps {
  children: ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  testID?: string;
}

export function SurfaceCard({ children, style, elevated = false, testID }: SurfaceCardProps) {
  return (
    <View
      style={[styles.card, elevated && styles.elevated, elevated && shadows.card, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
});
