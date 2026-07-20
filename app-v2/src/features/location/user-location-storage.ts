import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserLocationRecord } from '@/features/location/types/user-location';

export const USER_LOCATION_STORAGE_KEY = 'app.userLocation';

function isValidRecord(value: unknown): value is UserLocationRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as UserLocationRecord;
  return (
    typeof record.latitude === 'number' &&
    typeof record.longitude === 'number' &&
    typeof record.updatedAt === 'string'
  );
}

export async function loadStoredUserLocation(): Promise<UserLocationRecord | null> {
  const raw = await AsyncStorage.getItem(USER_LOCATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveStoredUserLocation(record: UserLocationRecord): Promise<void> {
  await AsyncStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(record));
}

export async function clearStoredUserLocation(): Promise<void> {
  await AsyncStorage.removeItem(USER_LOCATION_STORAGE_KEY);
}
