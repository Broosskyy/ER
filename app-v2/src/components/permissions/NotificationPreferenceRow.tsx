import { ActivityIndicator, StyleSheet, Switch, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon, type AppIconName } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { NotificationPreferenceViewModel } from '../onboarding/view-models';

export interface NotificationPreferenceRowProps {
  preference: NotificationPreferenceViewModel;
  onValueChange?: (enabled: boolean) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Notification preference toggle row — uses React Native Switch directly (no Switch foundation exists). */
export function NotificationPreferenceRow({
  preference,
  onValueChange,
  style,
  testID,
}: NotificationPreferenceRowProps) {
  const { theme } = useTheme();
  const iconName = (preference.icon ?? 'notifications-outline') as AppIconName;
  const disabled = preference.disabled || preference.loading;

  return (
    <View style={[styles.row, style]} testID={testID}>
      <AppIcon name={iconName} size="md" colorRole="accent" />
      <View style={styles.copy}>
        <AppText role="bodyStrong">{preference.title}</AppText>
        {preference.description ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            {preference.description}
          </AppText>
        ) : null}
      </View>
      {preference.loading ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : (
        <Switch
          value={Boolean(preference.enabled)}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.accentMuted }}
          thumbColor={preference.enabled ? theme.colors.accent : theme.colors.surface}
          accessibilityLabel={preference.title}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
});
