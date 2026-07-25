import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { useTheme } from '@/design/theme';

export interface SectionProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Mockup-conform section wrapper — spacing via tokens, no card chrome.
 */
export function Section({ title, subtitle, children, style, testID }: SectionProps) {
  const { theme } = useTheme();
  const { spacingRoles } = theme;

  return (
    <View
      testID={testID}
      style={[
        {
          gap: title || subtitle ? spacingRoles.sectionTitleGap : 0,
        },
        style,
      ]}
    >
      {title ? <AppText role="titleMedium">{title}</AppText> : null}
      {subtitle ? <AppText role="bodyMuted">{subtitle}</AppText> : null}
      <View style={{ gap: spacingRoles.cardContentGap }}>{children}</View>
    </View>
  );
}
