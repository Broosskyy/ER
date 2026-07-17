import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { colors } from '@/design/colors';
import { FavoritesProvider } from '@/features/favorites';
import { useAndroidSystemUi } from '@/platform/android-system-ui';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useAndroidSystemUi();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <FavoritesProvider>
      <StatusBar style="light" />
      {Platform.OS === 'android' ? <NavigationBar hidden style="dark" /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" />
      </Stack>
    </FavoritesProvider>
  );
}
