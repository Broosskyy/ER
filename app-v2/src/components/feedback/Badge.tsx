import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';
import { borderWidth } from '@/design/radii';

import { badgeMetrics, resolveBadgeStyle, type BadgeStatus } from './badge-styles';

export interface BadgeProps {
  label: string;
  status?: BadgeStatus;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Compact status pill — mockup 55 / ER_COMPONENT_LIBRARY §7.
 */
export function Badge({ label, status = 'default', style, testID }: BadgeProps) {
  const { theme } = useTheme();
  const resolved = resolveBadgeStyle(theme.colors, status);

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          backgroundColor: resolved.backgroundColor,
          borderColor: resolved.borderColor,
        },
        style,
      ]}
    >
      <AppText role="badge" color={resolved.textColor}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: badgeMetrics.borderRadius,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: badgeMetrics.paddingHorizontal,
    paddingVertical: badgeMetrics.paddingVertical,
  },
});
