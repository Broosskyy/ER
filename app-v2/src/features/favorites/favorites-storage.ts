import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EventId } from './types';

export const FAVORITES_STORAGE_KEY = '@eternal_rave/favorite_event_ids_v1';

function parseStoredFavoriteIds(raw: string | null): EventId[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is EventId => typeof value === 'string' && value.length > 0);
  } catch {
    return [];
  }
}

export async function loadFavoriteIdsFromStorage(): Promise<EventId[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    return parseStoredFavoriteIds(raw);
  } catch {
    return [];
  }
}

export async function saveFavoriteIdsToStorage(ids: readonly EventId[]): Promise<void> {
  try {
    const uniqueIds = Array.from(new Set(ids));
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(uniqueIds));
  } catch {
    // Persist errors must not crash the app.
  }
}
