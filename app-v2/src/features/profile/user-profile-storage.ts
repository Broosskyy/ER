import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_USER_PREFERENCES,
  DEFAULT_USER_PROFILE,
  type UserPreferences,
  type UserProfile,
} from './types/user-profile';

export const USER_PROFILE_STORAGE_KEY = '@eternal_rave/user_profile_v1';
export const USER_PREFERENCES_STORAGE_KEY = '@eternal_rave/user_preferences_v1';

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const profile = value as UserProfile;
  return typeof profile.id === 'string' && typeof profile.displayName === 'string';
}

export async function loadUserProfile(userId?: string): Promise<UserProfile> {
  try {
    const key = userId ? `${USER_PROFILE_STORAGE_KEY}_${userId}` : USER_PROFILE_STORAGE_KEY;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return DEFAULT_USER_PROFILE;
    }

    const parsed: unknown = JSON.parse(raw);
    return isUserProfile(parsed) ? parsed : DEFAULT_USER_PROFILE;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export async function saveUserProfile(profile: UserProfile, userId?: string): Promise<void> {
  try {
    const key = userId ? `${USER_PROFILE_STORAGE_KEY}_${profile.id}` : USER_PROFILE_STORAGE_KEY;
    await AsyncStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // Non-fatal.
  }
}

export async function loadUserPreferences(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_USER_PREFERENCES;
    }

    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { ...DEFAULT_USER_PREFERENCES, ...(parsed as UserPreferences) }
      : DEFAULT_USER_PREFERENCES;
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Non-fatal.
  }
}
