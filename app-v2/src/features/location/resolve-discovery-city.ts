import { appConfig } from '@/design/layout';
import { getDefaultCityValue } from '@/features/search/config/filter-config';

import type { UserLocationRecord } from './types/user-location';

/**
 * Discovery city label for search/map/notifications — distinct from raw GPS coordinates.
 * Manual city selection takes precedence over device geocode labels.
 */
export function resolveDiscoveryCityLabel(location: UserLocationRecord | null): string {
  if (!location) {
    return getDefaultCityValue();
  }

  if (location.source === 'manual' && location.city?.trim()) {
    return location.city.trim();
  }

  if (location.city?.trim()) {
    return location.city.trim();
  }

  if (location.region?.trim()) {
    return location.region.trim();
  }

  return getDefaultCityValue();
}

export function resolveDiscoveryCityId(location: UserLocationRecord | null): string | undefined {
  return location?.discoveryCityId;
}

export function isDeviceLocation(location: UserLocationRecord | null): boolean {
  return location?.source === 'device';
}

export function isManualDiscoveryCity(location: UserLocationRecord | null): boolean {
  return location?.source === 'manual';
}

export function getPlatformDefaultCityLabel(): string {
  return appConfig.defaultCity;
}
