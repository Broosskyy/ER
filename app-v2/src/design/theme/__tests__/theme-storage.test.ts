import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadThemeModePreference,
  saveThemeModePreference,
  THEME_MODE_STORAGE_KEY,
  isThemeModePreference,
} from '@/design/theme/theme-storage';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

describe('theme storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('validates theme mode preferences', () => {
    expect(isThemeModePreference('light')).toBe(true);
    expect(isThemeModePreference('dark')).toBe(true);
    expect(isThemeModePreference('system')).toBe(true);
    expect(isThemeModePreference('auto')).toBe(false);
  });

  it('persists and restores theme mode preference', async () => {
    await saveThemeModePreference('dark');
    expect(storage.get(THEME_MODE_STORAGE_KEY)).toBe('dark');
    expect(await loadThemeModePreference()).toBe('dark');
  });

  it('returns null for invalid stored values', async () => {
    storage.set(THEME_MODE_STORAGE_KEY, 'invalid');
    expect(await loadThemeModePreference()).toBeNull();
  });
});
