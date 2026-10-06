import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { layout } from '@/design/layout';
import { useTheme } from '@/design/theme';

export interface ContainerProps {
  children: ReactNode;
  centered?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Screen content container with horizontal padding and optional max width.
 */
export function Container({
  children,
  centered = true,
  fullWidth = false,
  style,
  testID,
}: ContainerProps) {
  const { theme } = useTheme();
  const shouldConstrainWidth = centered && !fullWidth;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          paddingHorizontal: theme.spacingRoles.screenHorizontal,
          maxWidth: shouldConstrainWidth ? layout.maxContentWidthDesktop : undefined,
        },
        centered && styles.centered,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    alignSelf: 'center',
  },
  fullWidth: {
    maxWidth: undefined,
  },
});
