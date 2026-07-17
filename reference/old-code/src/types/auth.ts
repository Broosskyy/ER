import { VerificationStatus } from '@/types/database';

/** App-facing role ladder (Band 4.6) */
export type AppRole = 'guest' | 'user' | 'organizer' | 'verified_organizer' | 'moderator' | 'admin';

export type DbUserRole = 'user' | 'organizer' | 'moderator' | 'admin';

export interface AuthRoleState {
  appRole: AppRole;
  isGuest: boolean;
  isAuthenticated: boolean;
  isUser: boolean;
  isOrganizer: boolean;
  isVerifiedOrganizer: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  verificationStatus: VerificationStatus | null;
}

export type AuthRequirement =
  | 'public'
  | 'authenticated'
  | 'user'
  | 'organizer'
  | 'verified_organizer'
  | 'moderator'
  | 'admin';

export const AUTH_PUBLIC_ROUTES = [
  '/home',
  '/search',
  '/map',
  '/favorites',
  '/profile',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;
