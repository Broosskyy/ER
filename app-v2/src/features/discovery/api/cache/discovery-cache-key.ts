import type { DiscoveryQuery } from '../../domain/discovery-query-types';
import type { DiscoveryApiVersion } from '../domain/discovery-api-version';

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function buildDiscoveryCacheKey(input: {
  version: DiscoveryApiVersion;
  route: string;
  query?: DiscoveryQuery;
  params?: Record<string, unknown>;
}): string {
  const parts = [
    `v=${input.version}`,
    `route=${input.route}`,
    input.params ? `params=${stableSerialize(input.params)}` : '',
    input.query ? `query=${stableSerialize(input.query)}` : '',
  ].filter(Boolean);

  return parts.join('|');
}

export function buildDiscoveryQueryCacheKey(
  version: DiscoveryApiVersion,
  query: DiscoveryQuery,
): string {
  return buildDiscoveryCacheKey({ version, route: 'events.query', query });
}
