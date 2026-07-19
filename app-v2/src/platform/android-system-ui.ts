import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

function applyAndroidSystemUi() {
  if (Platform.OS !== 'android') {
    return;
  }

  StatusBar.setHidden(false, 'fade');
  StatusBar.setStyle('light');
  NavigationBar.setHidden(true);
  NavigationBar.setStyle('dark');
}

export function useAndroidSystemUi() {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    applyAndroidSystemUi();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        applyAndroidSystemUi();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}
