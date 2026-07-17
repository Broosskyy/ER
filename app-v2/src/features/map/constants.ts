import type { Region } from 'react-native-maps';

import { appConfig } from '@/design/layout';
import type { EventDisplayModel } from '@/features/events';

export type MapCityId = 'Berlin';

export const MAP_CITY_REGIONS: Record<MapCityId, Region> = {
  Berlin: {
    latitude: 52.52,
    longitude: 13.405,
    latitudeDelta: 0.14,
    longitudeDelta: 0.14,
  },
};

export const DEFAULT_MAP_CITY: MapCityId = 'Berlin';

export function resolveMapCityLabel(city?: string): string {
  if (city && city.trim().length > 0) {
    return city;
  }

  return appConfig.defaultCity;
}

export function getInitialMapRegion(
  events: (EventDisplayModel & { latitude: number; longitude: number })[],
  preferredCity = appConfig.defaultCity,
): Region {
  const cityRegion = MAP_CITY_REGIONS[preferredCity as MapCityId];

  if (cityRegion) {
    return cityRegion;
  }

  if (events.length === 0) {
    return MAP_CITY_REGIONS[DEFAULT_MAP_CITY];
  }

  const latitudes = events.map((event) => event.latitude);
  const longitudes = events.map((event) => event.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.6, 0.08);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.6, 0.08);

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
}
