import { MAP_CITY_REGIONS } from '@/features/map/constants';
import { getActiveCityOptions } from '@/features/search/config/filter-config';

import type { ManualDiscoveryCityOption } from './UserLocationProvider';

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  koeln: MAP_CITY_REGIONS.Köln,
  berlin: {
    latitude: 52.52,
    longitude: 13.405,
  },
};

export function getManualDiscoveryCityOptions(): ManualDiscoveryCityOption[] {
  return getActiveCityOptions().map((city) => {
    const coords = CITY_COORDINATES[city.id] ?? MAP_CITY_REGIONS.Köln;
    return {
      id: city.id,
      label: city.label,
      latitude: coords.latitude,
      longitude: coords.longitude,
      country: 'Germany',
    };
  });
}
