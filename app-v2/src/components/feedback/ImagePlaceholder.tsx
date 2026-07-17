import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { radii } from '@/design/radii';

export interface ImagePlaceholderProps {
  label?: string;
  aspectRatio?: number;
  style?: ViewStyle;
  testID?: string;
}

export function ImagePlaceholder({
  label = 'Image',
  aspectRatio = 16 / 9,
  style,
  testID,
}: ImagePlaceholderProps) {
  return (
    <View style={[styles.container, { aspectRatio }, style]} testID={testID}>
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
});
