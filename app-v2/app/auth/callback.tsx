import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { resolveAuthCallbackDestination } from '@/features/auth/auth-redirect-utils';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { translateAuthError } from '@/features/i18n/auth-errors';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export default function AuthCallbackScreen() {
  useWebPageTitle('webTitles.authCallback');
  const router = useRouter();
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{
    code?: string;
    returnTo?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>();
  const { handleAuthCallback } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;

    void handleAuthCallback(params)
      .then((result) => {
        const destination = resolveAuthCallbackDestination(result.flow, params.returnTo);
        router.replace(destination as '/');
      })
      .catch((cause) => {
        setStatus('error');
        setErrorMessage(translateAuthError(cause, t));
      });
  }, [handleAuthCallback, params, router, t]);

  if (status === 'error') {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.container}>
          <AppText accessibilityRole="header" style={styles.title}>
            {t('auth.callback.errorTitle')}
          </AppText>
          <AppText accessibilityRole="alert" style={styles.error}>
            {errorMessage ?? t('auth.errors.generic')}
          </AppText>
          <PrimaryButton
            label={t('auth.callback.backToLogin')}
            onPress={() => router.replace(buildLoginHref('/') as '/login')}
          />
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('auth.callback.loading')}
          style={styles.loadingWrap}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <AppText style={styles.loadingText}>{t('auth.callback.loading')}</AppText>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacingRoles.screenHorizontal,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    ...textRoles.screenTitle,
    textAlign: 'center',
  },
  loadingWrap: {
    minHeight: 48,
    justifyContent: 'center',
  },
  loadingText: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
    textAlign: 'center',
  },
  error: {
    ...textRoles.body,
    color: colors.live,
    textAlign: 'center',
  },
});
