import { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/design/colors';

export interface SafeAreaContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  testID?: string;
}

export function SafeAreaContainer({
  children,
  style,
  edges = ['top', 'right', 'bottom', 'left'],
  testID,
}: SafeAreaContainerProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges} testID={testID}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    backgroundColor: colors.background,
  },
});
