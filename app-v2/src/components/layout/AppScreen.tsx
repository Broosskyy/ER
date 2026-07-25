import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '@/design/colors';

export interface AppScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function AppScreen({ children, style, testID }: AppScreenProps) {
  return (
    <View style={[styles.screen, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    backgroundColor: colors.background,
  },
});
