export interface UserLocationRecord {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  updatedAt: string;
}

export type UserLocationUiStatus = 'initial' | 'loading' | 'ready' | 'denied' | 'error';

export type UserLocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'unavailable'
  | 'resolve_failed'
  | 'network';
