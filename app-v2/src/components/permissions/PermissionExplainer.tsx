import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface PermissionExplainerProps {
  title: string;
  description: string;
  privacyHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function PermissionExplainer({
  title,
  description,
  privacyHint,
  style,
  testID,
}: PermissionExplainerProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" style={style} testID={testID}>
      <View style={styles.copy}>
        <AppText role="label">{title}</AppText>
        <AppText role="bodyMuted" color={theme.colors.textSecondary}>
          {description}
        </AppText>
        {privacyHint ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            {privacyHint}
          </AppText>
        ) : null}
      </View>
    </CardFoundation>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: spacing.xs,
  },
});
