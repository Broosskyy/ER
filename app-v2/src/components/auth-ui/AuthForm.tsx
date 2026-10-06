import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextButton } from '@/components/buttons/TextButton';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { AuthDivider } from './AuthDivider';
import { AuthNotice } from './AuthNotice';
import { SocialAuthButton } from './SocialAuthButton';
import type { AuthFormViewModel, SocialAuthProviderViewModel } from '../onboarding/view-models';

export interface AuthFormProps {
  form: AuthFormViewModel;
  children: ReactNode;
  noticeKind?: Parameters<typeof AuthNotice>[0]['kind'];
  noticeTitle?: string;
  noticeMessage?: string;
  socialProviders?: SocialAuthProviderViewModel[];
  onSocialPress?: (provider: SocialAuthProviderViewModel['provider']) => void;
  onSubmit?: () => void;
  onSecondaryAction?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Mockup 07/08 reusable auth form layout — no validation logic. */
export function AuthForm({
  form,
  children,
  noticeKind,
  noticeTitle,
  noticeMessage,
  socialProviders = [],
  onSocialPress,
  onSubmit,
  onSecondaryAction,
  loading = false,
  disabled = false,
  style,
  testID,
}: AuthFormProps) {
  const { theme } = useTheme();

  return (
    <Stack gap="lg" style={style} testID={testID}>
      <View style={styles.header}>
        <AppText role="titleLarge">{form.title}</AppText>
        {form.description ? (
          <AppText role="bodyMuted" color={theme.colors.textSecondary}>
            {form.description}
          </AppText>
        ) : null}
      </View>
      {noticeKind && noticeTitle ? (
        <AuthNotice kind={noticeKind} title={noticeTitle} message={noticeMessage} />
      ) : null}
      <Stack gap="md">{children}</Stack>
      <PrimaryButton
        label={form.submitLabel}
        onPress={onSubmit}
        loading={loading}
        disabled={disabled}
      />
      {form.secondaryActionLabel && onSecondaryAction ? (
        <TextButton label={form.secondaryActionLabel} onPress={onSecondaryAction} />
      ) : null}
      {socialProviders.length > 0 ? (
        <>
          <AuthDivider />
          <Stack gap="sm">
            {socialProviders.map((provider) => (
              <SocialAuthButton
                key={provider.provider}
                provider={provider}
                onPress={() => onSocialPress?.(provider.provider)}
                disabled={disabled || loading}
              />
            ))}
          </Stack>
        </>
      ) : null}
      {form.termsHint ? (
        <AppText role="caption" color={theme.colors.textSecondary} style={styles.terms}>
          {form.termsHint}
        </AppText>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  terms: {
    textAlign: 'center',
  },
});
