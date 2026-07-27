import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ThemeModePreference } from './types';

export const THEME_MODE_STORAGE_KEY = 'app.themeMode';

const THEME_MODE_PREFERENCES: readonly ThemeModePreference[] = ['light', 'dark', 'system'];

export function isThemeModePreference(value: string | null | undefined): value is ThemeModePreference {
  return Boolean(value && THEME_MODE_PREFERENCES.includes(value as ThemeModePreference));
}

export async function loadThemeModePreference(): Promise<ThemeModePreference | null> {
  const raw = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeModePreference(raw)) {
    return raw;
  }

  return null;
}

export async function saveThemeModePreference(mode: ThemeModePreference): Promise<void> {
  await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}
