import { Platform } from 'react-native';

import { getGoogleMapsApiKey } from './map-availability';

/** OpenStreetMap raster tiles — used on Android when no Google Maps API key is configured. */
export const OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_TILE_MAX_ZOOM = 19;

export function shouldUseOsmMapTiles(): boolean {
  return Platform.OS === 'android' && !getGoogleMapsApiKey();
}

export function getMapLoadTimeoutMs(): number {
  return 15000;
}
