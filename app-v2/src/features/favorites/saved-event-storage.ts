import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedEventRecord, SavedEventSource } from '@/features/saved/types/saved-event';

import type { EventId } from './types';

export const SAVED_EVENTS_STORAGE_KEY = '@eternal_rave/saved_events_v2';
export const SAVED_EVENTS_MIGRATED_FLAG_KEY = '@eternal_rave/saved_events_migrated_v2';

function isSavedEventRecord(value: unknown): value is SavedEventRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as SavedEventRecord;
  return typeof record.eventId === 'string' && typeof record.savedAt === 'string';
}

export async function loadSavedEventRecords(): Promise<SavedEventRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_EVENTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedEventRecord);
  } catch {
    return [];
  }
}

export async function saveSavedEventRecords(records: readonly SavedEventRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify(records));
    await AsyncStorage.setItem(SAVED_EVENTS_MIGRATED_FLAG_KEY, 'true');
  } catch {
    // Non-fatal.
  }
}

export async function hasSavedEventsMigrationFlag(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(SAVED_EVENTS_MIGRATED_FLAG_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}

export async function markSavedEventsMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_EVENTS_MIGRATED_FLAG_KEY, 'true');
  } catch {
    // Non-fatal.
  }
}

export function createSavedEventRecord(
  eventId: EventId,
  source: SavedEventSource = 'unknown',
): SavedEventRecord {
  return {
    eventId,
    savedAt: new Date().toISOString(),
    source,
    notificationPreference: 'default',
  };
}
