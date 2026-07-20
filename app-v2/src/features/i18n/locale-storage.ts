import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAppLocale, type AppLocale } from '@/features/i18n/locale';

export const LOCALE_STORAGE_KEY = 'app.locale';

export async function loadLocalePreference(): Promise<AppLocale | null> {
  const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);

  if (isAppLocale(raw)) {
    return raw;
  }

  return null;
}

export async function saveLocalePreference(locale: AppLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
