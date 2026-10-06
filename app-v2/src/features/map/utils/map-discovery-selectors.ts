import type { Event } from '@/features/events/types/event';
import type { MapRegion } from '../types';
import type { MapViewport } from '../types/discovery-models';

export function selectMapEvents(events: Event[]): Event[] {
  return events.filter(
    (event) => typeof event.latitude === 'number' && typeof event.longitude === 'number',
  );
}

export function buildMapEvents(events: Event[]) {
  return selectMapEvents(events).map((event) => ({
    id: event.id,
    title: event.title,
    latitude: event.latitude!,
    longitude: event.longitude!,
  }));
}

export function buildMapClubs() {
  return [];
}

export function findMapEvent(_events: ReturnType<typeof buildMapEvents>, _id: string) {
  return undefined;
}

export function findMapClub(_clubs: ReturnType<typeof buildMapClubs>, _id: string) {
  return undefined;
}

export function resolveInitialMapViewport(region: MapRegion): MapViewport {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return {
    centerLatitude: region.latitude,
    centerLongitude: region.longitude,
    latitudeDelta: region.latitudeDelta,
    longitudeDelta: region.longitudeDelta,
    bounds: {
      north: region.latitude + halfLat,
      south: region.latitude - halfLat,
      east: region.longitude + halfLng,
      west: region.longitude - halfLng,
    },
  };
}

export function shiftViewport(viewport: MapViewport, _delta: { latitude: number; longitude: number }): MapViewport {
  return viewport;
}
