export interface UserProfile {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  city?: string;
  bio?: string;
  preferredGenres?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  savedEventUpdates?: boolean;
  eventReminders?: boolean;
  marketing?: boolean;
}

export interface PrivacySettings {
  profileVisible?: boolean;
  showSavedCount?: boolean;
}

export interface UserPreferences {
  locationEnabled?: boolean;
  notificationSettings?: NotificationSettings;
  appearance?: 'light' | 'dark' | 'system';
  language?: 'de' | 'en';
  privacySettings?: PrivacySettings;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'local-user',
  displayName: 'Rave Guest',
  username: 'raveguest',
  city: 'Köln',
  bio: '',
  preferredGenres: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  locationEnabled: false,
  appearance: 'system',
  language: 'de',
  notificationSettings: {
    savedEventUpdates: true,
    eventReminders: true,
    marketing: false,
  },
  privacySettings: {
    profileVisible: true,
    showSavedCount: true,
  },
};
