import { describe, expect, it, vi } from 'vitest';

import {
  FAVORITES_STORAGE_KEY,
  loadFavoriteIdsFromStorage,
  saveFavoriteIdsToStorage,
} from '../favorites-storage';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

describe('favorites storage', () => {
  it('uses the central storage key', () => {
    expect(FAVORITES_STORAGE_KEY).toBe('@eternal_rave/favorite_event_ids_v1');
  });

  it('persists and loads unique event ids', async () => {
    await saveFavoriteIdsToStorage(['void-techno-saturday', 'fckng-serious', 'void-techno-saturday']);
    const loaded = await loadFavoriteIdsFromStorage();

    expect(loaded).toEqual(['void-techno-saturday', 'fckng-serious']);
  });

  it('returns an empty list for corrupted storage data', async () => {
    storage.set(FAVORITES_STORAGE_KEY, '{not-json');
    const loaded = await loadFavoriteIdsFromStorage();
    expect(loaded).toEqual([]);
  });
});
