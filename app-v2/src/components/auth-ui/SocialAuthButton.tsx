import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { SocialAuthProviderViewModel } from '../onboarding/view-models';

export interface SocialAuthButtonProps {
  provider: SocialAuthProviderViewModel;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const providerIcons = {
  google: 'logo-google' as const,
  apple: 'logo-apple' as const,
};

/** Mockup 07/08 social auth button — no OAuth logic. */
export function SocialAuthButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
  style,
  testID,
}: SocialAuthButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={provider.accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surface,
          opacity: pressed && !isDisabled ? 0.88 : isDisabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : (
        <AppIcon name={providerIcons[provider.provider]} size="md" colorRole="default" />
      )}
      <AppText role="label">{provider.label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: borderWidth.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
