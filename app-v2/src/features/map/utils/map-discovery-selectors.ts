import type { MapPinStatus } from '@/components/map/view-models';
import {
  EVENT_REFERENCE_DATE,
  eventRepository,
  hasMapCoordinates,
  isThisWeekEvent,
  toEventDisplayModel,
  type EventDisplayModel,
} from '@/features/events';
import type { EventFilters } from '@/features/search/constants';
import { applyEventFilters } from '@/features/search/utils/filter-events';

import { MAP_CLUB_FIXTURES } from '../data/map-club-fixtures';
import { getInitialMapRegion, type MapCityId } from '../constants';
import type {
  MapBounds,
  MapClub,
  MapEvent,
  MapFilter,
  MapMarker,
  MapViewport,
  MarkerStatus,
} from '../types/discovery-models';
import type { MapRegion } from '../types';

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const deltaLat = toRadians(toLatitude - fromLatitude);
  const deltaLng = toRadians(toLongitude - fromLongitude);
  const startLat = toRadians(fromLatitude);
  const endLat = toRadians(toLatitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatDistanceLabel(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

export function regionToViewport(region: MapRegion): MapViewport {
  const bounds: MapBounds = {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };

  return {
    centerLatitude: region.latitude,
    centerLongitude: region.longitude,
    latitudeDelta: region.latitudeDelta,
    longitudeDelta: region.longitudeDelta,
    bounds,
  };
}

export function viewportToRegion(viewport: MapViewport): MapRegion {
  return {
    latitude: viewport.centerLatitude,
    longitude: viewport.centerLongitude,
    latitudeDelta: viewport.latitudeDelta,
    longitudeDelta: viewport.longitudeDelta,
  };
}

export function shiftViewport(viewport: MapViewport, deltaLatitude: number, deltaLongitude: number): MapViewport {
  return regionToViewport({
    latitude: viewport.centerLatitude + deltaLatitude,
    longitude: viewport.centerLongitude + deltaLongitude,
    latitudeDelta: viewport.latitudeDelta,
    longitudeDelta: viewport.longitudeDelta,
  });
}

export function projectMarkerToCanvas(
  latitude: number,
  longitude: number,
  viewport: MapViewport,
  width: number,
  height: number,
): { left: number; top: number } {
  const latSpan = viewport.bounds.north - viewport.bounds.south;
  const lngSpan = viewport.bounds.east - viewport.bounds.west;
  const latRatio = latSpan === 0 ? 0.5 : (viewport.bounds.north - latitude) / latSpan;
  const lngRatio = lngSpan === 0 ? 0.5 : (longitude - viewport.bounds.west) / lngSpan;

  return {
    left: Math.max(12, Math.min(width - 12, lngRatio * width)),
    top: Math.max(12, Math.min(height - 12, latRatio * height)),
  };
}

function isTomorrowEvent(event: EventDisplayModel): boolean {
  const start = new Date(event.startDateTime).getTime();
  const tomorrow = new Date(EVENT_REFERENCE_DATE);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  return start >= tomorrow.getTime() && start < dayAfterTomorrow.getTime();
}

function isTodayEvent(event: EventDisplayModel): boolean {
  const start = new Date(event.startDateTime);
  const reference = EVENT_REFERENCE_DATE;

  return (
    start.getFullYear() === reference.getFullYear() &&
    start.getMonth() === reference.getMonth() &&
    start.getDate() === reference.getDate()
  );
}

export function resolveMarkerStatus(event: EventDisplayModel, featured = false): MarkerStatus {
  if (featured) {
    return 'featured';
  }

  if (isTodayEvent(event)) {
    return 'today';
  }

  if (isTomorrowEvent(event)) {
    return 'tomorrow';
  }

  if (isThisWeekEvent(event)) {
    return 'weekend';
  }

  return 'default';
}

export function resolveMapPinStatus(markerStatus: MarkerStatus, selected = false): MapPinStatus {
  if (selected) {
    return 'selected';
  }

  if (markerStatus === 'today') {
    return 'today';
  }

  return 'default';
}

function isFestivalEvent(event: EventDisplayModel): boolean {
  return event.genres.some((genre) => genre.toLowerCase().includes('festival'));
}

function passesMapFilter(
  event: EventDisplayModel,
  mapFilter: MapFilter,
  origin?: { latitude: number; longitude: number },
): boolean {
  if (mapFilter.freeOnly) {
    const price = event.priceText?.toLowerCase() ?? '';
    if (!price.includes('free') && !price.includes('kostenlos')) {
      return false;
    }
  }

  if (origin && mapFilter.radiusKm !== 'unlimited' && hasMapCoordinates(event)) {
    const distance = calculateDistanceKm(
      origin.latitude,
      origin.longitude,
      event.latitude,
      event.longitude,
    );

    if (distance > mapFilter.radiusKm) {
      return false;
    }
  }

  return true;
}

function sortMapEvents(events: MapEvent[], sortBy: MapFilter['sortBy']): MapEvent[] {
  const sorted = [...events];

  switch (sortBy) {
    case 'distance':
      return sorted.sort((left, right) => {
        const leftDistance = left.distanceKm ?? Number.MAX_VALUE;
        const rightDistance = right.distanceKm ?? Number.MAX_VALUE;
        return leftDistance - rightDistance;
      });
    case 'popular':
      return sorted.sort((left, right) => Number(right.featured) - Number(left.featured));
    case 'new':
      return sorted.sort(
        (left, right) =>
          new Date(right.event.startDateTime).getTime() - new Date(left.event.startDateTime).getTime(),
      );
    case 'date':
    default:
      return sorted.sort(
        (left, right) =>
          new Date(left.event.startDateTime).getTime() - new Date(right.event.startDateTime).getTime(),
      );
  }
}

export function buildMapEvents(
  filters: EventFilters,
  mapFilter: MapFilter,
  options?: {
    featuredIds?: string[];
    origin?: { latitude: number; longitude: number };
  },
): MapEvent[] {
  const featuredIds = new Set(options?.featuredIds ?? []);

  const events = applyEventFilters(eventRepository.getPublishedEvents(), filters)
    .map(toEventDisplayModel)
    .filter(hasMapCoordinates)
    .filter((event) => passesMapFilter(event, mapFilter, options?.origin))
    .map((event) => {
      const coordinates = event as EventDisplayModel & { latitude: number; longitude: number };
      const featured = featuredIds.has(event.id);
      const distanceKm =
        options?.origin && hasMapCoordinates(event)
          ? calculateDistanceKm(
              options.origin.latitude,
              options.origin.longitude,
              coordinates.latitude,
              coordinates.longitude,
            )
          : undefined;

      return {
        id: event.id,
        markerType: isFestivalEvent(event) ? 'festival' : 'event',
        markerStatus: resolveMarkerStatus(event, featured),
        title: event.title,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        image: event.image,
        dateLabel: event.date,
        timeLabel: event.startTime,
        venueLabel: event.venue,
        cityLabel: event.city,
        genreLabels: event.genres,
        distanceLabel: distanceKm !== undefined ? formatDistanceLabel(distanceKm) : undefined,
        distanceKm,
        ticketLabel: event.priceText,
        featured,
        event,
      } satisfies MapEvent;
    });

  return sortMapEvents(events, mapFilter.sortBy);
}

export function buildMapClubs(origin?: { latitude: number; longitude: number }, city?: string): MapClub[] {
  return MAP_CLUB_FIXTURES.filter((club) => {
    if (!city || city === 'all') {
      return true;
    }

    return club.cityLabel.toLowerCase() === city.toLowerCase();
  }).filter((club) => {
    if (!origin || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) {
      return true;
    }

    return calculateDistanceKm(origin.latitude, origin.longitude, club.latitude, club.longitude) <= 120;
  });
}

export function buildMapMarkers(events: MapEvent[], clubs: MapClub[]): MapMarker[] {
  return [...events, ...clubs];
}

export function resolveInitialMapViewport(
  events: MapEvent[],
  preferredCity?: string,
  origin?: { latitude: number; longitude: number },
): MapViewport {
  if (origin) {
    return regionToViewport(
      getInitialMapRegion(
        events.map((event) => ({
          ...event.event,
          latitude: event.latitude,
          longitude: event.longitude,
        })),
        preferredCity as MapCityId,
      ),
    );
  }

  const region = getInitialMapRegion(
    events.map((event) => ({
      ...event.event,
      latitude: event.latitude,
      longitude: event.longitude,
    })),
    preferredCity as MapCityId,
  );

  return regionToViewport(region);
}

export function findMapEvent(events: MapEvent[], id: string | null | undefined): MapEvent | undefined {
  if (!id) {
    return undefined;
  }

  return events.find((event) => event.id === id);
}

export function findMapClub(clubs: MapClub[], id: string | null | undefined): MapClub | undefined {
  if (!id) {
    return undefined;
  }

  return clubs.find((club) => club.id === id);
}
