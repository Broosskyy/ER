import type { DiscoveryQuery } from '../../domain/discovery-query-types';

export type DiscoveryCacheLayer = 'response' | 'query' | 'cdn' | 'edge';

export interface DiscoveryCachePolicy {
  layer: DiscoveryCacheLayer;
  ttlSeconds: number;
  staleWhileRevalidateSeconds?: number;
  cacheable: boolean;
}

export const DISCOVERY_CACHE_POLICIES: Record<string, DiscoveryCachePolicy> = {
  'events.list': { layer: 'response', ttlSeconds: 60, staleWhileRevalidateSeconds: 120, cacheable: true },
  'events.detail': { layer: 'response', ttlSeconds: 300, cacheable: true },
  'events.nearby': { layer: 'edge', ttlSeconds: 30, staleWhileRevalidateSeconds: 60, cacheable: true },
  'events.trending': { layer: 'cdn', ttlSeconds: 120, staleWhileRevalidateSeconds: 300, cacheable: true },
  'events.today': { layer: 'cdn', ttlSeconds: 60, cacheable: true },
  'events.weekend': { layer: 'cdn', ttlSeconds: 120, cacheable: true },
  'events.search': { layer: 'query', ttlSeconds: 30, cacheable: true },
  'events.filter': { layer: 'query', ttlSeconds: 60, cacheable: true },
  'venues.detail': { layer: 'response', ttlSeconds: 600, cacheable: true },
  'organizers.detail': { layer: 'response', ttlSeconds: 600, cacheable: true },
  'festivals.detail': { layer: 'response', ttlSeconds: 600, cacheable: true },
};

export interface DiscoveryCacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, policy: DiscoveryCachePolicy): void;
  invalidate(key: string): void;
}

export interface DiscoveryCacheHeaders {
  'Cache-Control'?: string;
  'CDN-Cache-Control'?: string;
  'X-Cache-Key'?: string;
}

export function buildDiscoveryCacheHeaders(
  routeKey: string,
  cacheKey: string,
  status: 'hit' | 'miss' | 'bypass',
): DiscoveryCacheHeaders {
  const policy = DISCOVERY_CACHE_POLICIES[routeKey];
  if (!policy?.cacheable || status === 'bypass') {
    return { 'Cache-Control': 'no-store', 'X-Cache-Key': cacheKey };
  }

  const stale = policy.staleWhileRevalidateSeconds
    ? `, stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`
    : '';

  return {
    'Cache-Control': `public, max-age=${policy.ttlSeconds}${stale}`,
    'CDN-Cache-Control': `public, max-age=${policy.ttlSeconds}${stale}`,
    'X-Cache-Key': cacheKey,
  };
}

export function resolveDiscoveryCachePolicy(routeKey: string): DiscoveryCachePolicy {
  return (
    DISCOVERY_CACHE_POLICIES[routeKey] ?? {
      layer: 'response',
      ttlSeconds: 60,
      cacheable: false,
    }
  );
}

export function isDiscoveryQueryCacheable(query: DiscoveryQuery): boolean {
  return !query.date?.includePast && !query.search?.text?.trim();
}
