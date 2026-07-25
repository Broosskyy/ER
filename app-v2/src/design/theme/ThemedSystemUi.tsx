import { useEffect } from 'react';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { getAndroidNavigationBarStyle, getExpoStatusBarStyle } from './theme-utils';
import { useTheme } from './ThemeProvider';

export function ThemedSystemUi() {
  const { theme } = useTheme();
  const statusBarStyle = getExpoStatusBarStyle(theme);
  const navigationBarStyle = getAndroidNavigationBarStyle(theme);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    NavigationBar.setStyle(navigationBarStyle);
  }, [navigationBarStyle]);

  return (
    <>
      <StatusBar style={statusBarStyle} />
      {Platform.OS === 'android' ? <NavigationBar style={navigationBarStyle} /> : null}
    </>
  );
}
