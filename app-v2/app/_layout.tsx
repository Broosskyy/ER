import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { ToastProvider } from '@/components/feedback/ToastProvider';
import { RepositoryProvider } from '@/data/repositories/RepositoryProvider';
import { ThemeProvider, ThemeSystemUi, useTheme } from '@/design/theme';
import { AuthProvider } from '@/features/auth';
import { I18nProvider } from '@/features/i18n';
import { FavoritesProvider } from '@/features/favorites';
import { UserLocationProvider } from '@/features/location/UserLocationProvider';
import { NotificationsProvider } from '@/features/notifications';
import { UserProfileProvider } from '@/features/profile/UserProfileProvider';
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
      <Stack.Screen name="profile/organizer" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/account" />
      <Stack.Screen name="settings/notifications" />
      <Stack.Screen name="settings/appearance" />
      <Stack.Screen name="settings/location" />
      <Stack.Screen name="settings/privacy" />
      <Stack.Screen name="settings/help" />
      <Stack.Screen name="settings/about" />
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
              <UserProfileProvider>
                <UserLocationProvider>
                  <NotificationsProvider>
                    <PwaProvider>
                      <AnalyticsProvider>
                        <ToastProvider>
                          <RootStack />
                        </ToastProvider>
                      </AnalyticsProvider>
                    </PwaProvider>
                  </NotificationsProvider>
                </UserLocationProvider>
              </UserProfileProvider>
            </FavoritesProvider>
          </RepositoryProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
