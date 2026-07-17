import type { Region } from 'react-native-maps';

const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

export function isRenderableCoordinate(
  latitude: number | undefined,
  longitude: number | undefined,
): latitude is number {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= MIN_LATITUDE &&
    latitude <= MAX_LATITUDE &&
    longitude >= MIN_LONGITUDE &&
    longitude <= MAX_LONGITUDE
  );
}

export function sanitizeMapRegion(region: Region): Region {
  const latitude = Number.isFinite(region.latitude) ? region.latitude : 50.9375;
  const longitude = Number.isFinite(region.longitude) ? region.longitude : 6.9603;
  const latitudeDelta = Number.isFinite(region.latitudeDelta)
    ? Math.min(Math.max(region.latitudeDelta, 0.01), 90)
    : 0.12;
  const longitudeDelta = Number.isFinite(region.longitudeDelta)
    ? Math.min(Math.max(region.longitudeDelta, 0.01), 180)
    : 0.12;

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
}
