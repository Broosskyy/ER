import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { RepositoryProvider } from '@/data/repositories/RepositoryProvider';
import { ThemeProvider, ThemeSystemUi, useTheme } from '@/design/theme';
import { AuthProvider } from '@/features/auth';
import { I18nProvider } from '@/features/i18n';
import { FavoritesProvider } from '@/features/favorites';
import { UserLocationProvider } from '@/features/location/UserLocationProvider';
import { NotificationsProvider } from '@/features/notifications';
import { PwaProvider } from '@/platform/pwa/PwaProvider';
import { AnalyticsProvider } from '@/platform/analytics/AnalyticsProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="create" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="profile/events" />
      <Stack.Screen name="collection/[type]" />
      <Stack.Screen name="design-preview" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider>
          <ThemeSystemUi />
          <RepositoryProvider>
            <FavoritesProvider>
              <UserLocationProvider>
                <NotificationsProvider>
                  <PwaProvider>
                    <AnalyticsProvider>
                      <RootStack />
                    </AnalyticsProvider>
                  </PwaProvider>
                </NotificationsProvider>
              </UserLocationProvider>
            </FavoritesProvider>
          </RepositoryProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
