import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { Divider } from '@/components/primitives/Divider';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface AuthDividerProps {
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 07/08 "ODER" divider. */
export function AuthDivider({ label = 'ODER', style, testID }: AuthDividerProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, style]} testID={testID}>
      <Divider style={styles.line} />
      <AppText role="caption" color={theme.colors.textSecondary}>
        {label}
      </AppText>
      <Divider style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  line: {
    flex: 1,
  },
});
