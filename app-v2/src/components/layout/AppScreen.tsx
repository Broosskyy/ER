import type { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';

export interface AppScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function AppScreen({ children, style, testID }: AppScreenProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.background }, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
