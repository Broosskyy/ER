import i18n from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';

import {
  FALLBACK_LOCALE,
  resolveLocalePreference,
  type AppLocale,
} from '@/features/i18n/locale';
import { loadLocalePreference, saveLocalePreference } from '@/features/i18n/locale-storage';
import { resources } from '@/features/i18n/resources';

let initialized = false;

function getDeviceLanguageTag(): string | null {
  const locale = getLocales()[0];
  return locale?.languageTag ?? locale?.languageCode ?? null;
}

export async function initI18n(): Promise<void> {
  if (initialized) {
    return;
  }

  const stored = await loadLocalePreference();
  const initialLocale = resolveLocalePreference(stored, getDeviceLanguageTag());

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLocale,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: ['de', 'en'],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  initialized = true;
}

export async function changeAppLocale(locale: AppLocale): Promise<void> {
  await saveLocalePreference(locale);
  await i18n.changeLanguage(locale);
}

export { i18n };
