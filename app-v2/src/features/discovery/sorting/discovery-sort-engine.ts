import type { Event } from '@/features/events/types/event';
import { isRecentlyAdded } from '@/features/events/status/recently-added-resolver';
import { calculateDistanceKm } from '@/features/location/utils/geo-distance';

import type { DiscoverySortField } from '../domain/discovery-query-types';
import type { DiscoveryLocationContext } from '../domain/discovery-query-types';

export interface DiscoverySortableEvent {
  event: Event;
  score?: number;
  distanceKm?: number;
}

export interface DiscoverySortContext {
  sortField: DiscoverySortField;
  sortDirection?: 'asc' | 'desc';
  location?: DiscoveryLocationContext;
  now?: Date;
}

function resolveDistanceKm(event: Event, location?: DiscoveryLocationContext): number | undefined {
  if (
    location?.latitude === undefined ||
    location.longitude === undefined ||
    event.latitude === undefined ||
    event.longitude === undefined
  ) {
    return undefined;
  }
  return calculateDistanceKm(
    location.latitude,
    location.longitude,
    event.latitude,
    event.longitude,
  );
}

function resolvePopularityScore(event: Event): number {
  let score = 0;
  if (event.imageUrl) score += 2;
  if (event.ticketUrl) score += 1;
  if (event.artists.length > 0) score += 1;
  return score;
}

export function sortDiscoveryEvents(
  items: DiscoverySortableEvent[],
  context: DiscoverySortContext,
): DiscoverySortableEvent[] {
  const direction = context.sortDirection ?? 'asc';
  const multiplier = direction === 'desc' ? -1 : 1;
  const now = context.now ?? new Date();

  const sorted = [...items].map((item) => ({
    ...item,
    distanceKm: item.distanceKm ?? resolveDistanceKm(item.event, context.location),
  }));

  sorted.sort((left, right) => {
    switch (context.sortField) {
      case 'distance': {
        const leftDistance = left.distanceKm ?? Number.MAX_VALUE;
        const rightDistance = right.distanceKm ?? Number.MAX_VALUE;
        return (leftDistance - rightDistance) * multiplier;
      }
      case 'newest':
        return (
          (new Date(right.event.publishedAt ?? right.event.createdAt).getTime() -
            new Date(left.event.publishedAt ?? left.event.createdAt).getTime()) *
          multiplier
        );
      case 'popularity':
        return (
          (resolvePopularityScore(right.event) - resolvePopularityScore(left.event)) * multiplier
        );
      case 'freshness': {
        const leftFresh = isRecentlyAdded(
          { publishedAt: left.event.publishedAt ?? left.event.createdAt },
          now,
        )
          ? 1
          : 0;
        const rightFresh = isRecentlyAdded(
          { publishedAt: right.event.publishedAt ?? right.event.createdAt },
          now,
        )
          ? 1
          : 0;
        return (rightFresh - leftFresh) * multiplier;
      }
      case 'alphabetical':
        return left.event.title.localeCompare(right.event.title, 'de') * multiplier;
      case 'relevance': {
        const leftScore = left.score ?? 0;
        const rightScore = right.score ?? 0;
        return (rightScore - leftScore || compareByDate(left.event, right.event)) * multiplier;
      }
      case 'date':
      default:
        return compareByDate(left.event, right.event) * multiplier;
    }
  });

  return sorted;
}

function compareByDate(left: Event, right: Event): number {
  return (
    new Date(left.startDateTime).getTime() - new Date(right.startDateTime).getTime() ||
    left.title.localeCompare(right.title, 'de')
  );
}

export function toDiscoverySortValue(
  item: DiscoverySortableEvent,
  sortField: DiscoverySortField,
): string | number {
  switch (sortField) {
    case 'distance':
      return item.distanceKm ?? Number.MAX_VALUE;
    case 'newest':
      return new Date(item.event.publishedAt ?? item.event.createdAt).getTime();
    case 'popularity':
      return resolvePopularityScore(item.event);
    case 'freshness':
      return new Date(item.event.publishedAt ?? item.event.createdAt).getTime();
    case 'alphabetical':
      return item.event.title.toLowerCase();
    case 'relevance':
      return item.score ?? 0;
    case 'date':
    default:
      return new Date(item.event.startDateTime).getTime();
  }
}
