import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { layout } from '@/design/layout';
import { spacing } from '@/design/spacing';

export interface ScreenContentProps {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  centered?: boolean;
  testID?: string;
}

export function ScreenContent({
  children,
  style,
  padded = true,
  centered = false,
  testID,
}: ScreenContentProps) {
  return (
    <View
      style={[
        styles.content,
        padded && styles.padded,
        centered && styles.centered,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  padded: {
    paddingHorizontal: spacing.screen,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
