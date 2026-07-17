import type { Region } from 'react-native-maps';

import { appConfig } from '@/design/layout';
import type { EventDisplayModel } from '@/features/events';

import { sanitizeMapRegion } from './utils/coordinates';

export type MapCityId = 'Köln';

export const MAP_CITY_REGIONS: Record<MapCityId, Region> = {
  Köln: {
    latitude: 50.9375,
    longitude: 6.9603,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  },
};

export const DEFAULT_MAP_CITY: MapCityId = 'Köln';

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
    return sanitizeMapRegion(cityRegion);
  }

  if (events.length === 0) {
    return sanitizeMapRegion(MAP_CITY_REGIONS[DEFAULT_MAP_CITY]);
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

  return sanitizeMapRegion({
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  });
}
