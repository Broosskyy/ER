import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { spacingRoles } from '@/design/spacing';
import { useResponsiveLayout } from '@/platform/responsive';

export interface ResponsiveScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function ResponsiveScreen({ children, style, testID }: ResponsiveScreenProps) {
  const { contentMaxWidth, isTabletOrLarger } = useResponsiveLayout();

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        isTabletOrLarger && styles.tabletPadding,
        contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center' } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  tabletPadding: {
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
