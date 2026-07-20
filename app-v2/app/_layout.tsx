import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { colors } from '@/design/colors';
import { RepositoryProvider } from '@/data/repositories/RepositoryProvider';
import { AuthProvider } from '@/features/auth';
import { I18nProvider } from '@/features/i18n';
import { FavoritesProvider } from '@/features/favorites';
import { UserLocationProvider } from '@/features/location/UserLocationProvider';
import { NotificationsProvider } from '@/features/notifications';
import { useAndroidSystemUi } from '@/platform/android-system-ui';
import { PwaProvider } from '@/platform/pwa/PwaProvider';
import { AnalyticsProvider } from '@/platform/analytics/AnalyticsProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useAndroidSystemUi();

  return (
    <I18nProvider>
    <AuthProvider>
    <RepositoryProvider>
      <FavoritesProvider>
        <UserLocationProvider>
        <NotificationsProvider>
          <PwaProvider>
            <AnalyticsProvider>
            <StatusBar style="light" />
            {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
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
              <Stack.Screen name="admin" />
            </Stack>
            </AnalyticsProvider>
          </PwaProvider>
        </NotificationsProvider>
        </UserLocationProvider>
      </FavoritesProvider>
    </RepositoryProvider>
    </AuthProvider>
    </I18nProvider>
  );
}
