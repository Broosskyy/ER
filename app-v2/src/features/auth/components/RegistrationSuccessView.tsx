import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useResendConfirmation } from '@/features/auth/hooks/useResendConfirmation';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface RegistrationSuccessViewProps {
  email: string;
  returnTo?: string;
}

export function RegistrationSuccessView({ email, returnTo }: RegistrationSuccessViewProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const loginHref = buildLoginHref(returnTo);
  const { resend, loading, succeeded, error } = useResendConfirmation(email, returnTo);

  return (
    <View style={styles.container}>
      <View
        accessibilityRole="image"
        accessibilityLabel={t('auth.register.success.iconA11y')}
        style={styles.iconWrap}
      >
        <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
      </View>

      <AppText accessibilityRole="header" style={styles.title}>
        {t('auth.register.success.title')}
      </AppText>

      <AppText style={styles.message}>{t('auth.register.success.message')}</AppText>

      <AppText style={styles.emailLabel}>{t('auth.register.success.emailLabel')}</AppText>
      <AppText style={styles.emailValue}>{email}</AppText>

      <AppText style={styles.spamHint}>{t('auth.register.success.spamHint')}</AppText>

      {succeeded ? (
        <AppText accessibilityRole="alert" style={styles.success}>
          {t('auth.resend.success')}
        </AppText>
      ) : null}

      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <SecondaryButton
        label={loading ? t('auth.resend.submitting') : t('auth.resend.submit')}
        onPress={resend}
        disabled={loading}
      />

      <PrimaryButton
        label={t('auth.register.success.backToLogin')}
        onPress={() => router.replace(loginHref as '/login')}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...textRoles.screenTitle,
    textAlign: 'center',
  },
  message: {
    ...textRoles.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emailLabel: {
    ...textRoles.metadata,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emailValue: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  spamHint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  success: {
    ...textRoles.metadata,
    color: colors.primary,
    textAlign: 'center',
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
    textAlign: 'center',
  },
});
