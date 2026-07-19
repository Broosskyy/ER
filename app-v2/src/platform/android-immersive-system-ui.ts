import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

function applyAndroidImmersiveSystemUi() {
  if (Platform.OS !== 'android') {
    return;
  }

  NavigationBar.setHidden(true);
  NavigationBar.setStyle('dark');
  StatusBar.setHidden(true, 'fade');
  StatusBar.setStyle('light');
}

export function useAndroidImmersiveSystemUi() {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    applyAndroidImmersiveSystemUi();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        applyAndroidImmersiveSystemUi();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}
