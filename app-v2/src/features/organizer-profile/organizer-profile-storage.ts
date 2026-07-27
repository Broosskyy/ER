import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createOrganizerProfileId,
  EMPTY_ORGANIZER_PROFILE,
  type OrganizerProfileRecord,
} from './types/organizer-profile';

export const ORGANIZER_PROFILE_STORAGE_KEY = 'app.organizerProfile.v1';

function isOrganizerProfileRecord(value: unknown): value is OrganizerProfileRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const profile = value as OrganizerProfileRecord;
  return (
    typeof profile.id === 'string' &&
    typeof profile.userId === 'string' &&
    typeof profile.name === 'string' &&
    Array.isArray(profile.socialLinks)
  );
}

export async function loadOrganizerProfile(userId: string): Promise<OrganizerProfileRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(ORGANIZER_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isOrganizerProfileRecord(parsed) || parsed.userId !== userId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function saveOrganizerProfile(profile: OrganizerProfileRecord): Promise<OrganizerProfileRecord> {
  const next: OrganizerProfileRecord = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ORGANIZER_PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function getOrCreateOrganizerProfile(
  userId: string,
  defaults?: Partial<Pick<OrganizerProfileRecord, 'name' | 'contactEmail'>>,
): Promise<OrganizerProfileRecord> {
  const existing = await loadOrganizerProfile(userId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const created: OrganizerProfileRecord = {
    id: createOrganizerProfileId(),
    userId,
    ...EMPTY_ORGANIZER_PROFILE,
    name: defaults?.name?.trim() ?? '',
    contactEmail: defaults?.contactEmail?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };

  return saveOrganizerProfile(created);
}
