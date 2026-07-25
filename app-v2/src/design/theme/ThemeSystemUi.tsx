import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { resolveNavigationBarStyle, resolveStatusBarStyle } from './resolve';
import { useTheme } from './useTheme';

/**
 * Applies StatusBar and Android navigation bar styles from the active theme.
 * Must render inside ThemeProvider.
 */
export function ThemeSystemUi() {
  const { theme } = useTheme();
  const statusBarStyle = resolveStatusBarStyle(theme);
  const navigationBarStyle = resolveNavigationBarStyle(theme);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const applyAndroidUi = () => {
      StatusBar.setHidden(false, 'fade');
      StatusBar.setStyle(statusBarStyle);
      NavigationBar.setHidden(false);
      NavigationBar.setStyle(navigationBarStyle);
    };

    applyAndroidUi();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        applyAndroidUi();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [navigationBarStyle, statusBarStyle]);

  return <StatusBar style={statusBarStyle} />;
}
