import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { colors } from '@/design/colors';
import { RepositoryProvider } from '@/data/repositories/RepositoryProvider';
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
<<<<<<< HEAD
    <FavoritesProvider>
      <StatusBar style="light" />
      {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="collection/[type]" />
      </Stack>
    </FavoritesProvider>
=======
    <RepositoryProvider>
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
          <Stack.Screen name="collection/[type]" />
          <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
        </Stack>
      </FavoritesProvider>
    </RepositoryProvider>
>>>>>>> 622c4db (feat(sprint-11): backend foundation and admin core)
  );
}
