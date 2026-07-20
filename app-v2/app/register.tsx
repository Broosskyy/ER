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
import { RegistrationSuccessView } from '@/features/auth/components/RegistrationSuccessView';
import { buildLoginHref, isSafeReturnRoute } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { isValidEmailAddress } from '@/features/auth/utils/email-validation';
import { translateAuthError } from '@/features/i18n/auth-errors';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export default function RegisterScreen() {
  useWebPageTitle('webTitles.register');
  const router = useRouter();
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { signUp, isAuthenticated, loading, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const safeReturnTo = isSafeReturnRoute(returnTo) ? returnTo : '/';

  if (!loading && isAuthenticated) {
    return <Redirect href={safeReturnTo as '/'} />;
  }

  const handleRegister = async () => {
    if (submitting) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!isValidEmailAddress(trimmedEmail)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    setError(null);
    clearAuthError();

    try {
      const result = await signUp(trimmedEmail, password, { returnTo: safeReturnTo });

      if (result.emailConfirmationRequired) {
        setRegisteredEmail(trimmedEmail);
        return;
      }

      router.replace(safeReturnTo as '/');
    } catch (cause) {
      setError(translateAuthError(cause, t));
    } finally {
      setSubmitting(false);
    }
  };

  const loginHref = buildLoginHref(safeReturnTo);

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <AppText accessibilityRole="header" style={styles.title}>
          {t('auth.brand')}
        </AppText>
        <AppText style={styles.subtitle}>{t('auth.register.subtitle')}</AppText>

        {registeredEmail ? (
          <RegistrationSuccessView email={registeredEmail} returnTo={safeReturnTo} />
        ) : (
          <View style={styles.form}>
            <AppText nativeID="register-email-label" style={styles.label}>
              {t('common.labels.email')}
            </AppText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel={t('common.labels.email')}
              accessibilityLabelledBy="register-email-label"
              style={styles.input}
              placeholder={t('common.placeholders.email')}
              placeholderTextColor={colorRoles.emptyStateDescription}
              editable={!submitting}
            />
            <AppText nativeID="register-password-label" style={styles.label}>
              {t('common.labels.password')}
            </AppText>
            <AppText style={styles.hint}>{t('auth.register.passwordHint')}</AppText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              accessibilityLabel={t('common.labels.password')}
              accessibilityLabelledBy="register-password-label"
              style={styles.input}
              placeholder={t('common.labels.password')}
              placeholderTextColor={colorRoles.emptyStateDescription}
              editable={!submitting}
            />
            <AppText nativeID="register-confirm-password-label" style={styles.label}>
              {t('common.labels.confirmPassword')}
            </AppText>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              accessibilityLabel={t('common.labels.confirmPassword')}
              accessibilityLabelledBy="register-confirm-password-label"
              style={styles.input}
              placeholder={t('common.labels.confirmPassword')}
              placeholderTextColor={colorRoles.emptyStateDescription}
              editable={!submitting}
              onSubmitEditing={() => {
                void handleRegister();
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
              <AppText accessibilityRole="alert" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <PrimaryButton
              label={submitting ? t('auth.register.submitting') : t('auth.register.submit')}
              onPress={handleRegister}
              disabled={
                submitting ||
                email.trim().length === 0 ||
                password.length === 0 ||
                confirmPassword.length === 0
              }
            />
          </View>
        )}

        {!registeredEmail ? (
          <>
            <Pressable
              onPress={() => router.replace(loginHref as '/login')}
              style={styles.linkButton}
              accessibilityRole="button"
              disabled={submitting}
            >
              <AppText style={styles.linkText}>{t('auth.register.alreadyHaveAccount')}</AppText>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/')}
              style={styles.backLink}
              accessibilityRole="button"
              disabled={submitting}
            >
              <AppText style={styles.backText}>{t('common.actions.backToApp')}</AppText>
            </Pressable>
          </>
        ) : null}
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
  error: {
    ...textRoles.metadata,
    color: colors.live,
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
