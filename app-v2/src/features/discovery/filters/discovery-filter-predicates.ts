import type { Event } from '@/features/events/types/event';
import type { VenueType } from '@/features/events/domain/festival-foundation';
import { calculateDistanceKm } from '@/features/location/utils/geo-distance';

import type {
  DiscoveryDateFilter,
  DiscoveryEntityFilter,
  DiscoveryLocationContext,
  DiscoveryPriceFilter,
  DiscoveryQuery,
  DiscoveryVenueEnvironmentFilter,
} from '../domain/discovery-query-types';
import type { DiscoveryFilterContext, DiscoveryFilterPredicate } from '../domain/discovery-filter-types';
import { eventStartWithinWindow, resolveDiscoveryDateWindow } from './discovery-date-presets';

const INDOOR_VENUE_TYPES = new Set<VenueType>(['club', 'warehouse', 'hybrid']);
const OUTDOOR_VENUE_TYPES = new Set<VenueType>(['open_air', 'festival_ground', 'temporary']);

function isFreeEvent(event: Event): boolean {
  const price = event.priceText?.toLowerCase() ?? '';
  return (
    price.includes('free') ||
    price.includes('kostenlos') ||
    price.includes('gratis') ||
    price === '0' ||
    price === '0 €'
  );
}

function matchesVenueEnvironment(
  event: Event,
  filter: DiscoveryVenueEnvironmentFilter,
): boolean {
  const wantsIndoor = filter.indoor ?? false;
  const wantsOutdoor = filter.outdoor ?? false;
  if (!wantsIndoor && !wantsOutdoor) {
    return true;
  }

  const venueType = event.venueType ?? 'unknown';
  const isIndoor = INDOOR_VENUE_TYPES.has(venueType);
  const isOutdoor = OUTDOOR_VENUE_TYPES.has(venueType) || venueType === 'hybrid';

  if (wantsIndoor && wantsOutdoor) {
    return isIndoor || isOutdoor || venueType === 'unknown';
  }
  if (wantsIndoor) {
    return isIndoor;
  }
  return isOutdoor;
}

function createDatePredicate(
  dateFilter: DiscoveryDateFilter | undefined,
  context: DiscoveryFilterContext,
): DiscoveryFilterPredicate<Event> | null {
  const window = resolveDiscoveryDateWindow(dateFilter, context.now);
  if (!window) {
    if (dateFilter?.includePast) {
      return null;
    }
    return {
      id: 'upcoming-default',
      applies: (event) => new Date(event.endDateTime ?? event.startDateTime) >= context.now,
    };
  }

  return {
    id: `date-${dateFilter?.preset ?? 'custom'}`,
    applies: (event) => eventStartWithinWindow(event.startDateTime, window),
  };
}

function createEntityPredicates(entities?: DiscoveryEntityFilter): DiscoveryFilterPredicate<Event>[] {
  if (!entities) {
    return [];
  }

  const predicates: DiscoveryFilterPredicate<Event>[] = [];

  if (entities.city) {
    predicates.push({
      id: 'city',
      applies: (event) => event.city.toLowerCase() === entities.city!.toLowerCase(),
    });
  }
  if (entities.venueId) {
    predicates.push({
      id: 'venue',
      applies: (event) => event.venueId === entities.venueId,
    });
  }
  if (entities.organizerId) {
    predicates.push({
      id: 'organizer',
      applies: (event) => event.organizerId === entities.organizerId,
    });
  }
  if (entities.festivalEditionId) {
    predicates.push({
      id: 'festival-edition',
      applies: (event) => event.festivalEditionId === entities.festivalEditionId,
    });
  }
  if (entities.festivalId) {
    predicates.push({
      id: 'festival',
      applies: (event) => event.festivalId === entities.festivalId,
    });
  }
  if (entities.genres?.length) {
    const labels = entities.genres.map((genre) => genre.toLowerCase());
    predicates.push({
      id: 'genres',
      applies: (event) =>
        event.genres.some((genre) => labels.includes(genre.toLowerCase())),
    });
  }
  if (entities.genreIds?.length) {
    const ids = new Set(entities.genreIds);
    predicates.push({
      id: 'genre-ids',
      applies: (event) => event.genreIds?.some((genreId) => ids.has(genreId)) ?? false,
    });
  }

  return predicates;
}

function createPricePredicates(price?: DiscoveryPriceFilter): DiscoveryFilterPredicate<Event>[] {
  if (!price) {
    return [];
  }

  const predicates: DiscoveryFilterPredicate<Event>[] = [];
  if (price.freeOnly) {
    predicates.push({
      id: 'free-only',
      applies: (event) => isFreeEvent(event),
    });
  }
  return predicates;
}

function createLocationPredicate(
  location?: DiscoveryLocationContext,
): DiscoveryFilterPredicate<Event> | null {
  if (!location?.latitude || !location.longitude || !location.radiusKm) {
    return null;
  }

  const { latitude, longitude, radiusKm } = location;
  return {
    id: 'nearby-radius',
    applies: (event) => {
      if (event.latitude === undefined || event.longitude === undefined) {
        return false;
      }
      return (
        calculateDistanceKm(latitude, longitude, event.latitude, event.longitude) <= radiusKm
      );
    },
  };
}

function createVenueEnvironmentPredicate(
  venueEnvironment?: DiscoveryVenueEnvironmentFilter,
): DiscoveryFilterPredicate<Event> | null {
  if (!venueEnvironment) {
    return null;
  }
  return {
    id: 'venue-environment',
    applies: (event) => matchesVenueEnvironment(event, venueEnvironment),
  };
}

export function buildDiscoveryFilterPredicates(
  query: DiscoveryQuery,
  context: DiscoveryFilterContext,
): DiscoveryFilterPredicate<Event>[] {
  const predicates: DiscoveryFilterPredicate<Event>[] = [];

  const datePredicate = createDatePredicate(query.date, context);
  if (datePredicate) {
    predicates.push(datePredicate);
  }

  predicates.push(...createEntityPredicates(query.entities));

  const locationPredicate = createLocationPredicate(query.location);
  if (locationPredicate) {
    predicates.push(locationPredicate);
  }

  predicates.push(...createPricePredicates(query.price));

  const venueEnvPredicate = createVenueEnvironmentPredicate(query.venueEnvironment);
  if (venueEnvPredicate) {
    predicates.push(venueEnvPredicate);
  }

  return predicates;
}
