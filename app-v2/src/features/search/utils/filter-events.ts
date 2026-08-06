import type { Event } from '@/features/events/types/event';
import { parseGermanPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import {
  EVENT_REFERENCE_DATE,
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';
import { isSemanticallyFreeEvent } from '@/features/events/domain/event-price-availability-semantics';
import { isFeaturedEventId } from '@/features/events/data/home-config';
import type { VenueType } from '@/features/events/domain/festival-foundation';
import { calculateDistanceKm } from '@/features/location/utils/geo-distance';
import {
  getDateLabel,
  getGenreLabel,
  getSortLabel,
  getActiveDistanceOptions,
  getActiveFestivalOptions,
  getActiveOrganizerOptions,
  getActivePriceOptions,
  getActiveVenueEnvironmentOptions,
  getActiveVenueOptions,
} from '@/features/search/config/filter-config';

import {
  DEFAULT_EVENT_FILTERS,
  type EventFilters,
  type SortByFilter,
  buildEventSearchIndex,
  type DateRangeFilter,
  type GenreFilterId,
} from '../constants';
import {
  isGlobalLocationScope,
} from '../domain/location-scope';
import { discoveryCitiesMatch } from '@/features/location/normalize-discovery-city';

const INDOOR_VENUE_TYPES = new Set<VenueType>(['club', 'warehouse', 'hybrid']);
const OUTDOOR_VENUE_TYPES = new Set<VenueType>(['open_air', 'festival_ground', 'temporary']);

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function getQueryTerms(query: string): string[] {
  return normalizeQuery(query).split(/\s+/).filter(Boolean);
}

export function matchesSearchQuery(event: Event, query: string): boolean {
  const terms = getQueryTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = buildEventSearchIndex(event);
  return terms.every((term) => haystack.includes(term));
}

export function matchesSearchGenres(event: Event, genres: GenreFilterId[]): boolean {
  if (genres.length === 0) {
    return true;
  }

  const selectedLabels = genres.map((genreId) => getGenreLabel(genreId).toLowerCase());
  return event.genres.some((genre) => selectedLabels.includes(genre.toLowerCase()));
}

/** @deprecated Use matchesSearchGenres */
export function matchesSearchGenre(event: Event, genreId: string): boolean {
  if (genreId === 'all') {
    return true;
  }
  return matchesSearchGenres(event, [genreId as GenreFilterId]);
}

function isSameDay(isoDateTime: string, referenceDate: Date): boolean {
  const eventDate = new Date(isoDateTime);
  return (
    eventDate.getFullYear() === referenceDate.getFullYear() &&
    eventDate.getMonth() === referenceDate.getMonth() &&
    eventDate.getDate() === referenceDate.getDate()
  );
}

function eventStartWithinCustomWindow(
  event: Event,
  startAt?: string | null,
  endAt?: string | null,
): boolean {
  if (!startAt && !endAt) {
    return true;
  }

  const eventStart = new Date(event.startDateTime).getTime();
  const windowStart = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY;
  const windowEnd = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
  return eventStart >= windowStart && eventStart <= windowEnd;
}

export function matchesDateRange(
  event: Event,
  dateRange: DateRangeFilter,
  referenceDate: Date = EVENT_REFERENCE_DATE,
  customStartAt?: string | null,
  customEndAt?: string | null,
): boolean {
  if (customStartAt || customEndAt) {
    return eventStartWithinCustomWindow(event, customStartAt, customEndAt);
  }

  if (dateRange === 'all-dates') {
    return true;
  }

  if (dateRange === 'today') {
    return isSameDay(event.startDateTime, referenceDate);
  }

  if (dateRange === 'this-weekend') {
    return isThisWeekEvent(event, referenceDate);
  }

  return isUpcomingEvent(event, referenceDate);
}

export function matchesCity(event: Event, city: string, locationScope = DEFAULT_EVENT_FILTERS.locationScope): boolean {
  if (!city.trim() || isGlobalLocationScope(locationScope)) {
    return true;
  }

  return discoveryCitiesMatch(city, event.city);
}

function matchesVenueEnvironment(event: Event, venueEnvironment: EventFilters['venueEnvironment']): boolean {
  if (venueEnvironment === 'any') {
    return true;
  }

  const option = getActiveVenueEnvironmentOptions().find((item) => item.id === venueEnvironment);
  if (!option) {
    return true;
  }

  const wantsIndoor = option.indoor ?? false;
  const wantsOutdoor = option.outdoor ?? false;
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

function matchesPrice(event: Event, price: EventFilters['price']): boolean {
  if (price === 'any') {
    return true;
  }

  const option = getActivePriceOptions().find((item) => item.id === price);
  if (!option) {
    return true;
  }

  if (option.freeOnly) {
    return isSemanticallyFreeEvent({
      priceText: event.priceText,
      ticketAvailability: event.ticketStatus,
    });
  }

  if (option.maxPriceEur != null) {
    const parsed = parseGermanPriceText(event.priceText ?? '');
    const amount = parsed?.amount;
    if (amount == null) {
      return false;
    }
    return amount <= option.maxPriceEur;
  }

  return true;
}

function resolveEntityFilterId(
  filterId: string | null,
  options: ReturnType<typeof getActiveVenueOptions>,
): string | null {
  if (!filterId) {
    return null;
  }
  const option = options.find((item) => item.id === filterId);
  return option?.entityId ?? filterId;
}

function matchesDistance(
  event: Event,
  filters: EventFilters,
  latitude?: number,
  longitude?: number,
): boolean {
  if (filters.distance === 'any' || !latitude || !longitude) {
    return true;
  }

  const distanceOption = getActiveDistanceOptions().find((item) => item.id === filters.distance);
  const radiusKm = distanceOption?.radiusKm;
  if (!radiusKm) {
    return true;
  }

  if (event.latitude === undefined || event.longitude === undefined) {
    return false;
  }

  return calculateDistanceKm(latitude, longitude, event.latitude, event.longitude) <= radiusKm;
}

export function sortEvents(events: Event[], sortBy: SortByFilter): Event[] {
  const sorted = [...events];

  if (sortBy === 'alphabetical') {
    return sorted.sort((left, right) => left.title.localeCompare(right.title, 'de'));
  }

  if (sortBy === 'newest') {
    return sorted.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  if (sortBy === 'trending') {
    return sorted.sort((left, right) => {
      const leftFeatured = isFeaturedEventId(left.id) ? 1 : 0;
      const rightFeatured = isFeaturedEventId(right.id) ? 1 : 0;
      if (rightFeatured !== leftFeatured) {
        return rightFeatured - leftFeatured;
      }
      return left.startDateTime.localeCompare(right.startDateTime);
    });
  }

  return sorted.sort((left, right) => left.startDateTime.localeCompare(right.startDateTime));
}

export interface ApplyEventFiltersLocationContext {
  latitude?: number;
  longitude?: number;
}

export interface ApplyEventFiltersOptions {
  preserveCollectionScope?: boolean;
  location?: ApplyEventFiltersLocationContext;
  referenceDate?: Date;
}

export function applyEventFilters(
  events: Event[],
  filters: EventFilters,
  options: ApplyEventFiltersOptions = {},
): Event[] {
  const referenceDate = options.referenceDate ?? EVENT_REFERENCE_DATE;
  const venueEntityId = resolveEntityFilterId(filters.venueId, getActiveVenueOptions());
  const organizerEntityId = resolveEntityFilterId(filters.organizerId, getActiveOrganizerOptions());
  const festivalEntityId = resolveEntityFilterId(filters.festivalId, getActiveFestivalOptions());

  const filtered = events.filter(
    (event) =>
      matchesSearchQuery(event, filters.query) &&
      matchesSearchGenres(event, filters.genres) &&
      matchesCity(event, filters.city, filters.locationScope) &&
      (options.preserveCollectionScope ||
        matchesDateRange(
          event,
          filters.dateRange,
          referenceDate,
          filters.dateStartAt,
          filters.dateEndAt,
        )) &&
      matchesPrice(event, filters.price) &&
      matchesVenueEnvironment(event, filters.venueEnvironment) &&
      (!venueEntityId || event.venueId === venueEntityId) &&
      (!organizerEntityId || event.organizerId === organizerEntityId) &&
      (!festivalEntityId || event.festivalId === festivalEntityId) &&
      matchesDistance(event, filters, options.location?.latitude, options.location?.longitude),
  );

  return sortEvents(filtered, filters.sortBy);
}

export function hasDiscoverySearchQuery(filters: EventFilters): boolean {
  return filters.query.trim().length > 0;
}

export function hasActiveFilters(filters: EventFilters): boolean {
  return countActiveFilters(filters) > 0 || hasDiscoverySearchQuery(filters);
}

export function isExploreMode(filters: EventFilters): boolean {
  return filters.query.trim().length === 0;
}

export function countActiveFilters(filters: EventFilters): number {
  let count = 0;

  if (filters.dateRange !== DEFAULT_EVENT_FILTERS.dateRange) count += 1;
  if (filters.genres.length > 0) count += 1;
  if (!isGlobalLocationScope(filters.locationScope) || filters.city.trim()) count += 1;
  if (filters.entityTab !== DEFAULT_EVENT_FILTERS.entityTab) count += 1;
  if (filters.sortBy !== DEFAULT_EVENT_FILTERS.sortBy) count += 1;
  if (filters.distance !== DEFAULT_EVENT_FILTERS.distance) count += 1;
  if (filters.price !== DEFAULT_EVENT_FILTERS.price) count += 1;
  if (filters.venueEnvironment !== DEFAULT_EVENT_FILTERS.venueEnvironment) count += 1;
  if (filters.venueId) count += 1;
  if (filters.organizerId) count += 1;
  if (filters.festivalId) count += 1;
  if (filters.dateStartAt || filters.dateEndAt) count += 1;

  return count;
}

export function getActiveFilterSummaries(filters: EventFilters): string[] {
  const parts: string[] = [];

  if (filters.dateRange !== DEFAULT_EVENT_FILTERS.dateRange) {
    parts.push(getDateLabel(filters.dateRange));
  }

  if (filters.genres.length === 1) {
    parts.push(getGenreLabel(filters.genres[0]!));
  } else if (filters.genres.length > 1) {
    parts.push(`${filters.genres.length} Genres`);
  }

  if (!isGlobalLocationScope(filters.locationScope) || filters.city.trim()) {
    if (filters.locationScope === 'nearby') {
      const distance = getActiveDistanceOptions().find((option) => option.id === filters.distance);
      parts.push(distance?.label ?? 'In der Nähe');
    } else if (filters.city.trim()) {
      parts.push(filters.city);
    } else {
      parts.push('Standortfilter');
    }
  }

  if (filters.sortBy !== DEFAULT_EVENT_FILTERS.sortBy) {
    parts.push(getSortLabel(filters.sortBy));
  }

  if (filters.distance !== DEFAULT_EVENT_FILTERS.distance) {
    const distance = getActiveDistanceOptions().find((option) => option.id === filters.distance);
    if (distance) {
      parts.push(distance.label);
    }
  }

  if (filters.price !== DEFAULT_EVENT_FILTERS.price) {
    const price = getActivePriceOptions().find((option) => option.id === filters.price);
    if (price) {
      parts.push(price.label);
    }
  }

  if (filters.venueEnvironment !== DEFAULT_EVENT_FILTERS.venueEnvironment) {
    const environment = getActiveVenueEnvironmentOptions().find(
      (option) => option.id === filters.venueEnvironment,
    );
    if (environment) {
      parts.push(environment.label);
    }
  }

  if (filters.venueId) {
    const venue = getActiveVenueOptions().find((option) => option.id === filters.venueId);
    if (venue) {
      parts.push(venue.label);
    }
  }

  if (filters.organizerId) {
    const organizer = getActiveOrganizerOptions().find((option) => option.id === filters.organizerId);
    if (organizer) {
      parts.push(organizer.label);
    }
  }

  if (filters.festivalId) {
    const festival = getActiveFestivalOptions().find((option) => option.id === filters.festivalId);
    if (festival) {
      parts.push(festival.label);
    }
  }

  if (filters.dateStartAt || filters.dateEndAt) {
    parts.push('Zeitraum');
  }

  return parts;
}

export function summarizeActiveFilters(filters: EventFilters): string {
  return getActiveFilterSummaries(filters).join(' · ');
}
