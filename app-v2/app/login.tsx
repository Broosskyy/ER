import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildForgotPasswordHref, buildRegisterHref, isSafeReturnRoute } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useResendConfirmation } from '@/features/auth/hooks/useResendConfirmation';
import { isValidEmailAddress } from '@/features/auth/utils/email-validation';
import {
  translateAuthError,
} from '@/features/i18n/auth-errors';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export default function LoginScreen() {
  useWebPageTitle('webTitles.login');
  const router = useRouter();
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { signIn, isAuthenticated, loading, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const safeReturnTo = isSafeReturnRoute(returnTo) ? returnTo : '/';
  const registerHref = buildRegisterHref(safeReturnTo);
  const forgotPasswordHref = buildForgotPasswordHref(safeReturnTo);
  const trimmedEmail = email.trim();
  const showResendConfirmation = error === t('auth.errors.emailNotConfirmed') && trimmedEmail.length > 0;
  const resendConfirmation = useResendConfirmation(trimmedEmail, safeReturnTo);

  if (!loading && isAuthenticated) {
    return <Redirect href={safeReturnTo as '/'} />;
  }

  const handleLogin = async () => {
    if (submitting) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!isValidEmailAddress(trimmedEmail)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    setSubmitting(true);
    setError(null);
    clearAuthError();

    try {
      await signIn(trimmedEmail, password);
      router.replace(safeReturnTo as '/');
    } catch (cause) {
      setError(translateAuthError(cause, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <AppText accessibilityRole="header" style={styles.title}>
          {t('auth.brand')}
        </AppText>
        <AppText style={styles.subtitle}>{t('auth.login.title')}</AppText>
        <View style={styles.form}>
          <AppText nativeID="login-email-label" style={styles.label}>
            {t('common.labels.email')}
          </AppText>
          <AppText style={styles.hint}>{t('auth.login.emailHint')}</AppText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel={t('common.labels.email')}
            accessibilityLabelledBy="login-email-label"
            style={styles.input}
            placeholder={t('common.placeholders.email')}
            placeholderTextColor={colorRoles.emptyStateDescription}
            editable={!submitting}
          />
          <AppText nativeID="login-password-label" style={styles.label}>
            {t('common.labels.password')}
          </AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            accessibilityLabel={t('common.labels.password')}
            accessibilityLabelledBy="login-password-label"
            style={styles.input}
            placeholder={t('common.labels.password')}
            placeholderTextColor={colorRoles.emptyStateDescription}
            editable={!submitting}
            onSubmitEditing={() => {
              void handleLogin();
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showPassword ? t('common.actions.hidePassword') : t('common.actions.showPassword')
            }
            onPress={() => setShowPassword((current) => !current)}
            style={styles.togglePassword}
            disabled={submitting}
          >
            <AppText style={styles.togglePasswordText}>
              {showPassword ? t('common.actions.hidePassword') : t('common.actions.showPassword')}
            </AppText>
          </Pressable>
          {error ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <AppText style={styles.error}>{error}</AppText>
              {error === t('auth.errors.emailNotConfirmed') ? (
                <AppText style={styles.errorHint}>{t('auth.errors.emailNotConfirmedSpamHint')}</AppText>
              ) : null}
              {showResendConfirmation ? (
                <>
                  {resendConfirmation.succeeded ? (
                    <AppText style={styles.success}>{t('auth.resend.success')}</AppText>
                  ) : null}
                  {resendConfirmation.error ? (
                    <AppText style={styles.error}>{resendConfirmation.error}</AppText>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.resend.submit')}
                    onPress={resendConfirmation.resend}
                    disabled={resendConfirmation.loading || submitting}
                    style={styles.resendButton}
                  >
                    <AppText style={styles.linkText}>
                      {resendConfirmation.loading
                        ? t('auth.resend.submitting')
                        : t('auth.resend.submit')}
                    </AppText>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}
          <PrimaryButton
            label={submitting ? t('auth.login.submitting') : t('auth.login.submit')}
            onPress={handleLogin}
            disabled={submitting || email.trim().length === 0 || password.length === 0}
          />
        </View>
        <Pressable
          onPress={() => router.replace(forgotPasswordHref as '/forgot-password')}
          style={styles.linkButton}
          accessibilityRole="button"
          disabled={submitting}
        >
          <AppText style={styles.linkText}>{t('auth.login.forgotPassword')}</AppText>
        </Pressable>
        <Pressable
          onPress={() => router.replace(registerHref as '/register')}
          style={styles.linkButton}
          accessibilityRole="button"
          disabled={submitting}
        >
          <AppText style={styles.linkText}>{t('auth.login.noAccount')}</AppText>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/')}
          style={styles.backLink}
          accessibilityRole="button"
          disabled={submitting}
        >
          <AppText style={styles.backText}>{t('common.actions.backToApp')}</AppText>
        </Pressable>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacingRoles.screenHorizontal,
    justifyContent: 'center',
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    ...textRoles.screenTitle,
  },
  subtitle: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  label: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  hint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  togglePassword: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  togglePasswordText: {
    ...textRoles.metadata,
    color: colors.primary,
  },
  errorBox: {
    gap: spacing.xs,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
  errorHint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  success: {
    ...textRoles.metadata,
    color: colors.primary,
  },
  resendButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkButton: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    ...textRoles.metadata,
    color: colors.primary,
  },
  backLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    ...textRoles.metadata,
    color: colors.primary,
  },
});
