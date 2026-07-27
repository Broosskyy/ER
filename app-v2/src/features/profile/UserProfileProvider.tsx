import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_USER_PREFERENCES,
  DEFAULT_USER_PROFILE,
  type UserPreferences,
  type UserProfile,
} from './types/user-profile';
import {
  loadUserPreferences,
  loadUserProfile,
  saveUserPreferences,
  saveUserProfile,
} from './user-profile-storage';

interface UserProfileContextValue {
  profile: UserProfile;
  preferences: UserPreferences;
  hydrated: boolean;
  updateProfile: (next: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (next: Partial<UserPreferences>) => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.all([loadUserProfile(), loadUserPreferences()]).then(([loadedProfile, loadedPreferences]) => {
      if (!active) {
        return;
      }

      setProfile(loadedProfile);
      setPreferences(loadedPreferences);
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const updateProfile = useCallback(async (next: Partial<UserProfile>) => {
    const updated = {
      ...profile,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    await saveUserProfile(updated);
  }, [profile]);

  const updatePreferences = useCallback(async (next: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...next };
    setPreferences(updated);
    await saveUserPreferences(updated);
  }, [preferences]);

  const value = useMemo<UserProfileContextValue>(
    () => ({
      profile,
      preferences,
      hydrated,
      updateProfile,
      updatePreferences,
    }),
    [hydrated, preferences, profile, updatePreferences, updateProfile],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext);

  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }

  return context;
}
