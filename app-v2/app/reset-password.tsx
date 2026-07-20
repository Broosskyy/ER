import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { translateAuthError } from '@/features/i18n/auth-errors';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export default function ResetPasswordScreen() {
  useWebPageTitle('webTitles.resetPassword');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { updatePassword, signOut, isAuthenticated, loading, clearAuthError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !isAuthenticated) {
    return <Redirect href={buildLoginHref('/') as '/login'} />;
  }

  const handleSubmit = async () => {
    if (submitting) {
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
      await updatePassword(password);
      await signOut();
      router.replace(buildLoginHref('/') as '/login');
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
          {t('auth.resetPassword.title')}
        </AppText>
        <AppText style={styles.subtitle}>{t('auth.resetPassword.subtitle')}</AppText>

        <View style={styles.form}>
          <AppText nativeID="reset-password-label" style={styles.label}>
            {t('common.labels.password')}
          </AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            accessibilityLabel={t('common.labels.password')}
            accessibilityLabelledBy="reset-password-label"
            style={styles.input}
            placeholder={t('common.labels.password')}
            placeholderTextColor={colorRoles.emptyStateDescription}
            editable={!submitting}
          />
          <AppText nativeID="reset-confirm-password-label" style={styles.label}>
            {t('common.labels.confirmPassword')}
          </AppText>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            accessibilityLabel={t('common.labels.confirmPassword')}
            accessibilityLabelledBy="reset-confirm-password-label"
            style={styles.input}
            placeholder={t('common.labels.confirmPassword')}
            placeholderTextColor={colorRoles.emptyStateDescription}
            editable={!submitting}
            onSubmitEditing={() => {
              void handleSubmit();
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
            label={submitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
            onPress={handleSubmit}
            disabled={
              submitting || password.length === 0 || confirmPassword.length === 0
            }
          />
        </View>
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
});
