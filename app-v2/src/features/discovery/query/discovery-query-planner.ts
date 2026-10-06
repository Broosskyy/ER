import type { DiscoveryQuery } from '../domain/discovery-query-types';

export interface DiscoverySourceQuery {
  venueId?: string;
  organizerId?: string;
  festivalEditionId?: string;
  festivalId?: string;
  city?: string;
  startDateGte?: string;
  startDateLte?: string;
}

export interface DiscoveryQueryPlan {
  pushdown: DiscoverySourceQuery;
  requiresInMemorySearch: boolean;
  requiresInMemoryGeo: boolean;
  requiresInMemoryRanking: boolean;
  estimatedIndexUse: string[];
}

export function planDiscoveryQuery(query: DiscoveryQuery): DiscoveryQueryPlan {
  const pushdown: DiscoverySourceQuery = {};
  const estimatedIndexUse: string[] = ['events_discovery_published_start_idx'];

  if (query.entities?.venueId) {
    pushdown.venueId = query.entities.venueId;
    estimatedIndexUse.push('events_discovery_venue_start_idx');
  }
  if (query.entities?.organizerId) {
    pushdown.organizerId = query.entities.organizerId;
    estimatedIndexUse.push('events_discovery_organizer_start_idx');
  }
  if (query.entities?.festivalEditionId) {
    pushdown.festivalEditionId = query.entities.festivalEditionId;
    estimatedIndexUse.push('events_discovery_festival_edition_idx');
  }
  if (query.entities?.festivalId) {
    pushdown.festivalId = query.entities.festivalId;
  }
  if (query.entities?.city) {
    pushdown.city = query.entities.city;
    estimatedIndexUse.push('events_discovery_city_start_idx');
  }

  if (query.date?.startAt) {
    pushdown.startDateGte = query.date.startAt;
  }
  if (query.date?.endAt) {
    pushdown.startDateLte = query.date.endAt;
  }

  return {
    pushdown,
    requiresInMemorySearch: Boolean(query.search?.text?.trim()),
    requiresInMemoryGeo: Boolean(
      query.location?.radiusKm ||
        query.sortBy === 'distance' ||
        query.surface === 'home_nearby' ||
        query.surface === 'map',
    ),
    requiresInMemoryRanking:
      query.sortBy === 'relevance' ||
      query.diversify !== false ||
      query.surface === 'home_featured' ||
      query.surface === 'search_events',
    estimatedIndexUse,
  };
}

export function hasDiscoveryPushdown(plan: DiscoveryQueryPlan): boolean {
  return Object.keys(plan.pushdown).length > 0;
}
