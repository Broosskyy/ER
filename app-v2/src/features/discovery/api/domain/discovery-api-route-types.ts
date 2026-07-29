import type { DiscoveryQuery } from '../../domain/discovery-query-types';
import type { DiscoveryApiAccessTier } from '../security/discovery-api-access';

export const DISCOVERY_API_ROUTES = [
  'events',
  'events.detail',
  'events.nearby',
  'events.trending',
  'events.today',
  'events.weekend',
  'events.search',
  'events.filter',
  'venues.detail',
  'venues.events',
  'organizers.detail',
  'organizers.events',
  'festivals.detail',
  'festivals.events',
] as const;

export type DiscoveryApiRoute = (typeof DISCOVERY_API_ROUTES)[number];

export interface DiscoveryApiRequestContext {
  route: DiscoveryApiRoute;
  version: string;
  accessTier: DiscoveryApiAccessTier;
  requestId: string;
  clientId?: string;
}

export interface DiscoveryApiRouteRequest<TParams = Record<string, unknown>> {
  context: DiscoveryApiRequestContext;
  params: TParams;
  query?: DiscoveryQuery;
}

export interface DiscoveryEntityRouteParams {
  id: string;
}

export interface DiscoveryNearbyRouteParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  cursor?: DiscoveryQuery['cursor'];
}

export interface DiscoverySearchRouteParams {
  text: string;
  limit?: number;
  cursor?: DiscoveryQuery['cursor'];
  locale?: DiscoveryQuery['search'] extends infer S
    ? S extends { locale?: infer L }
      ? L
      : never
    : never;
}

export interface DiscoveryFilterRouteParams {
  query: DiscoveryQuery;
}
