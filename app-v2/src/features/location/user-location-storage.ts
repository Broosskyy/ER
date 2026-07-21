import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserLocationRecord } from '@/features/location/types/user-location';

export const USER_LOCATION_STORAGE_KEY = 'app.userLocation';

function isValidRecord(value: unknown): value is UserLocationRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as UserLocationRecord;
  const latitudeValid =
    typeof record.latitude === 'number' &&
    Number.isFinite(record.latitude) &&
    record.latitude >= -90 &&
    record.latitude <= 90;
  const longitudeValid =
    typeof record.longitude === 'number' &&
    Number.isFinite(record.longitude) &&
    record.longitude >= -180 &&
    record.longitude <= 180;

  return latitudeValid && longitudeValid && typeof record.updatedAt === 'string';
}

export async function loadStoredUserLocation(): Promise<UserLocationRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isValidRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveStoredUserLocation(record: UserLocationRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Caller treats persistence as best-effort.
  }
}

export async function clearStoredUserLocation(): Promise<void> {
  await AsyncStorage.removeItem(USER_LOCATION_STORAGE_KEY);
}
