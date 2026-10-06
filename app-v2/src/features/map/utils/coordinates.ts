import type { MapRegion } from '../types';

export function hasValidMapCoordinates(latitude?: number, longitude?: number): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number';
}

export function isRenderableCoordinate(latitude?: number, longitude?: number): boolean {
  return hasValidMapCoordinates(latitude, longitude);
}

export function sanitizeMapRegion(region: MapRegion): MapRegion {
  return {
    latitude: region.latitude,
    longitude: region.longitude,
    latitudeDelta: Math.max(region.latitudeDelta, 0.01),
    longitudeDelta: Math.max(region.longitudeDelta, 0.01),
  };
}
