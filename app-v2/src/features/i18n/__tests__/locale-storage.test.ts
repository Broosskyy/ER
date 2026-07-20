import { beforeEach, describe, expect, it, vi } from 'vitest';

import { changeAppLocale, i18n, initI18n } from '@/features/i18n/i18n';
import { LOCALE_STORAGE_KEY, loadLocalePreference, saveLocalePreference } from '@/features/i18n/locale-storage';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'de-DE', languageCode: 'de' }],
}));

describe('language preference persistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('saves and loads locale preference', async () => {
    await saveLocalePreference('en');
    expect(await loadLocalePreference()).toBe('en');
    expect(storage.get(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('changes app locale immediately and persists it', async () => {
    await initI18n();
    await changeAppLocale('en');
    expect(i18n.language).toBe('en');
    expect(await loadLocalePreference()).toBe('en');
  });
});
