import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref, isSafeReturnRoute } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { isValidEmailAddress } from '@/features/auth/utils/email-validation';
import { translateAuthError } from '@/features/i18n/auth-errors';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export default function ForgotPasswordScreen() {
  useWebPageTitle('webTitles.forgotPassword');
  const router = useRouter();
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { resetPasswordForEmail, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const safeReturnTo = isSafeReturnRoute(returnTo) ? returnTo : '/';
  const loginHref = buildLoginHref(safeReturnTo);

  const handleSubmit = async () => {
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
    setSuccess(false);
    clearAuthError();

    try {
      await resetPasswordForEmail(trimmedEmail, safeReturnTo);
      setSuccess(true);
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
          {t('auth.forgotPassword.title')}
        </AppText>
        <AppText style={styles.subtitle}>{t('auth.forgotPassword.subtitle')}</AppText>

        {success ? (
          <View accessibilityRole="alert" style={styles.successBox}>
            <AppText style={styles.success}>{t('auth.forgotPassword.success')}</AppText>
          </View>
        ) : (
          <View style={styles.form}>
            <AppText nativeID="forgot-email-label" style={styles.label}>
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
              accessibilityLabelledBy="forgot-email-label"
              style={styles.input}
              placeholder={t('common.placeholders.email')}
              placeholderTextColor={colorRoles.emptyStateDescription}
              editable={!submitting}
            />
            {error ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <PrimaryButton
              label={submitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
              onPress={handleSubmit}
              disabled={submitting || email.trim().length === 0}
            />
          </View>
        )}

        <Pressable
          onPress={() => router.replace(loginHref as '/login')}
          style={styles.linkButton}
          accessibilityRole="button"
          disabled={submitting}
        >
          <AppText style={styles.linkText}>{t('auth.forgotPassword.backToLogin')}</AppText>
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
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
  successBox: {
    marginTop: spacing.lg,
  },
  success: {
    ...textRoles.body,
    color: colors.textSecondary,
    textAlign: 'center',
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
});
