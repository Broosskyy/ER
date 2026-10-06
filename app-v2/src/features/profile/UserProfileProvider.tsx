import {

  createContext,

  ReactNode,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useState,

} from 'react';



import { useAuth } from '@/features/auth/AuthContext';

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



interface ProfileHydrationState {

  userKey: string;

  profile: UserProfile;

  preferences: UserPreferences;

  hydrated: boolean;

}



const UserProfileContext = createContext<UserProfileContextValue | null>(null);



function seedProfileFromAuth(userId: string, email?: string | null, existing?: UserProfile): UserProfile {

  const emailLocal = email?.split('@')[0]?.trim();

  const base = existing ?? DEFAULT_USER_PROFILE;



  return {

    ...base,

    id: userId,

    displayName:

      base.displayName.trim() && base.displayName.trim() !== 'Rave Guest'

        ? base.displayName.trim()

        : emailLocal || base.displayName,

    updatedAt: base.updatedAt,

  };

}



function resolveUserKey(isAuthenticated: boolean, userId?: string): string {

  return isAuthenticated && userId ? userId : 'guest';

}



const INITIAL_HYDRATION: ProfileHydrationState = {

  userKey: '',

  profile: DEFAULT_USER_PROFILE,

  preferences: DEFAULT_USER_PREFERENCES,

  hydrated: false,

};



export function UserProfileProvider({ children }: { children: ReactNode }) {

  const { user, isAuthenticated } = useAuth();

  const activeUserKey = resolveUserKey(isAuthenticated, user?.id);

  const [hydration, setHydration] = useState<ProfileHydrationState>(INITIAL_HYDRATION);



  useEffect(() => {

    let active = true;

    const userKey = activeUserKey;



    async function hydrateProfile() {

      const [loadedProfile, loadedPreferences] = await Promise.all([

        loadUserProfile(user?.id),

        loadUserPreferences(),

      ]);



      if (!active) {

        return;

      }



      const nextProfile =

        isAuthenticated && user?.id

          ? seedProfileFromAuth(user.id, user.email, loadedProfile)

          : DEFAULT_USER_PROFILE;



      setHydration({

        userKey,

        profile: nextProfile,

        preferences: loadedPreferences,

        hydrated: true,

      });

    }



    void hydrateProfile();



    return () => {

      active = false;

    };

  }, [activeUserKey, isAuthenticated, user?.email, user?.id]);



  const hydrated = hydration.hydrated && hydration.userKey === activeUserKey;

  const profile = hydrated ? hydration.profile : DEFAULT_USER_PROFILE;

  const preferences = hydrated ? hydration.preferences : DEFAULT_USER_PREFERENCES;



  const updateProfile = useCallback(

    async (next: Partial<UserProfile>) => {

      setHydration((current) => {

        const updated = {

          ...current.profile,

          ...next,

          updatedAt: new Date().toISOString(),

        };

        void saveUserProfile(updated, user?.id);

        return {

          ...current,

          profile: updated,

        };

      });

    },

    [user?.id],

  );



  const updatePreferences = useCallback(async (next: Partial<UserPreferences>) => {

    setHydration((current) => {

      const updated = { ...current.preferences, ...next };

      void saveUserPreferences(updated);

      return {

        ...current,

        preferences: updated,

      };

    });

  }, []);



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


