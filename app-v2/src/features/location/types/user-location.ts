export interface UserLocationRecord {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  updatedAt: string;
  /** How the location was obtained — device GPS vs manual discovery city. */
  source?: 'device' | 'manual' | 'stored';
  /** Filter-config city id when user picks a discovery city manually. */
  discoveryCityId?: string;
}

export type UserLocationUiStatus = 'initial' | 'loading' | 'ready' | 'denied' | 'error';

export type UserLocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'unavailable'
  | 'resolve_failed'
  | 'network';
