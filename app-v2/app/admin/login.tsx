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
import { getErrorMessage } from '@/core/errors/app-error';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { isSafeAdminReturnRoute } from '@/features/admin/admin-route-utils';
import { AdminForbiddenState } from '@/features/admin/components/AdminForbidden';
import { AdminLoadingState } from '@/features/admin/components/AdminStates';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

export default function AdminLoginScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.adminLogin);
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { signIn, isAuthenticated, hasAdminAccess, isRoleLoading, clearAuthError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const safeReturnTo = isSafeAdminReturnRoute(returnTo) ? returnTo : '/admin';

  if (isAuthenticated && isRoleLoading) {
    return <AdminLoadingState label="Loading permissions…" />;
  }

  if (isAuthenticated && !hasAdminAccess) {
    return <AdminForbiddenState />;
  }

  const handleLogin = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    clearAuthError();

    try {
      await signIn(email.trim(), password);
      router.replace(safeReturnTo as '/admin');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <AppText accessibilityRole="header" style={styles.title}>
          Eternal Rave Admin
        </AppText>
        <AppText style={styles.subtitle}>Sign in to manage events and imports.</AppText>
        <View style={styles.form}>
          <AppText nativeID="admin-login-email-label" style={styles.label}>
            Email
          </AppText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email"
            accessibilityLabelledBy="admin-login-email-label"
            style={styles.input}
            placeholder="admin@example.com"
            placeholderTextColor={colorRoles.emptyStateDescription}
            editable={!submitting}
          />
          <AppText nativeID="admin-login-password-label" style={styles.label}>
            Password
          </AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            accessibilityLabel="Password"
            accessibilityLabelledBy="admin-login-password-label"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colorRoles.emptyStateDescription}
            editable={!submitting}
            onSubmitEditing={() => {
              void handleLogin();
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((current) => !current)}
            style={styles.togglePassword}
          >
            <AppText style={styles.togglePasswordText}>
              {showPassword ? 'Hide password' : 'Show password'}
            </AppText>
          </Pressable>
          {error ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <PrimaryButton
            label={submitting ? 'Signing in…' : 'Sign in'}
            onPress={handleLogin}
            disabled={submitting || email.trim().length === 0 || password.length === 0}
          />
        </View>
        <Pressable onPress={() => router.replace('/')} style={styles.backLink} accessibilityRole="button">
          <AppText style={styles.backText}>Back to app</AppText>
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
