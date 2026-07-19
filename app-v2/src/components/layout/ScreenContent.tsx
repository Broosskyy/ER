import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';

import { layout } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { getContentMaxWidth } from '@/platform/responsive';

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
  const { width } = useWindowDimensions();
  const responsiveMaxWidth = getContentMaxWidth(width) ?? layout.maxContentWidth;

  return (
    <View
      style={[
        styles.content,
        { maxWidth: responsiveMaxWidth },
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
