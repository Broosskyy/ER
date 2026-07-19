import { useRouter } from 'expo-router';
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

export default function AdminLoginScreen() {
  const router = useRouter();
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('admin@eternalrave.app');
  const [password, setPassword] = useState('admin-local-dev');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/admin');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <AppText style={styles.title}>Eternal Rave Admin</AppText>
        <AppText style={styles.subtitle}>Sign in to manage events and content.</AppText>
        <View style={styles.form}>
          <AppText style={styles.label}>Email</AppText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholderTextColor={colorRoles.emptyStateDescription}
          />
          <AppText style={styles.label}>Password</AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            placeholderTextColor={colorRoles.emptyStateDescription}
          />
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <PrimaryButton
            label={submitting ? 'Signing in…' : 'Sign in'}
            onPress={handleLogin}
            disabled={submitting}
          />
        </View>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
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
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
  backLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  backText: {
    ...textRoles.metadata,
    color: colors.primary,
  },
});
