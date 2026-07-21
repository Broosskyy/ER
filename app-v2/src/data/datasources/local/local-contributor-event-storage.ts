import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AdminEventRecord } from '@/data/types/records';

const STORAGE_KEY = 'app.contributorEvents.v1';

function isAdminEventRecord(value: unknown): value is AdminEventRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as AdminEventRecord;
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.status === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

export async function loadPersistedContributorEvents(): Promise<AdminEventRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isAdminEventRecord);
  } catch {
    return [];
  }
}

export async function savePersistedContributorEvents(events: AdminEventRecord[]): Promise<void> {
  try {
    const contributorOnly = events.filter((event) => Boolean(event.createdBy?.trim()));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contributorOnly));
  } catch {
    // Best-effort persistence for local mock mode.
  }
}
