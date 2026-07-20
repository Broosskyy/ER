import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadStoredUserLocation,
  saveStoredUserLocation,
  USER_LOCATION_STORAGE_KEY,
} from '@/features/location/user-location-storage';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

describe('user location persistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('saves and loads the last resolved location', async () => {
    const record = {
      latitude: 50.9375,
      longitude: 6.9603,
      city: 'Köln',
      country: 'Germany',
      countryCode: 'DE',
      updatedAt: '2026-07-20T10:00:00.000Z',
    };

    await saveStoredUserLocation(record);
    expect(await loadStoredUserLocation()).toEqual(record);
    expect(storage.get(USER_LOCATION_STORAGE_KEY)).toContain('"city":"Köln"');
  });

  it('ignores invalid stored payloads', async () => {
    storage.set(USER_LOCATION_STORAGE_KEY, '{"latitude":"invalid"}');
    expect(await loadStoredUserLocation()).toBeNull();
  });
});
