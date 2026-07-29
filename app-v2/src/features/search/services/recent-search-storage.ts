import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_STORAGE_KEY = 'er.recent-searches.v1';
const MAX_RECENT_SEARCHES = 10;

export interface RecentSearchRecord {
  id: string;
  query: string;
  searchedAt: string;
}

let memoryFallback: RecentSearchRecord[] = [];

export async function loadRecentSearches(): Promise<RecentSearchRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentSearchRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [...memoryFallback];
  }
}

export async function saveRecentSearch(query: string): Promise<RecentSearchRecord[]> {
  const normalized = query.trim();
  if (!normalized) {
    return loadRecentSearches();
  }

  const existing = await loadRecentSearches();
  const next: RecentSearchRecord[] = [
    {
      id: `recent-${Date.now()}`,
      query: normalized,
      searchedAt: new Date().toISOString(),
    },
    ...existing.filter((item) => item.query.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    await AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    memoryFallback = next;
  }

  return next;
}

export async function removeRecentSearch(id: string): Promise<RecentSearchRecord[]> {
  const existing = await loadRecentSearches();
  const next = existing.filter((item) => item.id !== id);

  try {
    await AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    memoryFallback = next;
  }

  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
  } catch {
    memoryFallback = [];
  }
}

export function resetRecentSearchesForTests(): void {
  memoryFallback = [];
}
