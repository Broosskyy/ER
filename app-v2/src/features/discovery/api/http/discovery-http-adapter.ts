import type { DiscoveryQuery } from '../../domain/discovery-query-types';
import { buildDiscoveryCacheHeaders } from '../cache/discovery-cache-policy';
import { buildDiscoveryCacheKey } from '../cache/discovery-cache-key';
import type { DiscoveryApiResult } from '../domain/discovery-api-envelope';
import { negotiateDiscoveryApiVersion } from '../domain/discovery-api-version';
import type { DiscoveryApiRoute } from '../domain/discovery-api-route-types';
import { resolveDiscoveryAccessTier } from '../security/discovery-api-access';
import { DiscoveryApiRouter, type DiscoveryApiRouterRequest } from '../discovery-api-router';
import type { DiscoveryQueryPlatform } from '../services/discovery-query-platform';

export interface DiscoveryHttpRequest {
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string | undefined>;
  queryString?: Record<string, string | undefined>;
  body?: unknown;
}

export interface DiscoveryHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: DiscoveryApiResult<unknown>;
}

const ROUTE_PATHS: Record<string, DiscoveryApiRoute> = {
  '/v1/discovery/events': 'events',
  '/v1/discovery/events/nearby': 'events.nearby',
  '/v1/discovery/events/trending': 'events.trending',
  '/v1/discovery/events/today': 'events.today',
  '/v1/discovery/events/weekend': 'events.weekend',
  '/v1/discovery/events/search': 'events.search',
  '/v1/discovery/events/filter': 'events.filter',
};

function matchRoute(path: string): { route: DiscoveryApiRoute; params: Record<string, unknown> } | null {
  const normalized = path.split('?')[0]?.replace(/\/$/, '') ?? path;

  if (ROUTE_PATHS[normalized]) {
    return { route: ROUTE_PATHS[normalized], params: {} };
  }

  const detailMatchers: Array<{ pattern: RegExp; route: DiscoveryApiRoute }> = [
    { pattern: /^\/v1\/discovery\/events\/([^/]+)$/, route: 'events.detail' },
    { pattern: /^\/v1\/discovery\/venues\/([^/]+)\/events$/, route: 'venues.events' },
    { pattern: /^\/v1\/discovery\/venues\/([^/]+)$/, route: 'venues.detail' },
    { pattern: /^\/v1\/discovery\/organizers\/([^/]+)\/events$/, route: 'organizers.events' },
    { pattern: /^\/v1\/discovery\/organizers\/([^/]+)$/, route: 'organizers.detail' },
    { pattern: /^\/v1\/discovery\/festivals\/([^/]+)\/events$/, route: 'festivals.events' },
    { pattern: /^\/v1\/discovery\/festivals\/([^/]+)$/, route: 'festivals.detail' },
  ];

  for (const matcher of detailMatchers) {
    const match = normalized.match(matcher.pattern);
    if (match?.[1]) {
      return { route: matcher.route, params: { id: decodeURIComponent(match[1]) } };
    }
  }

  return null;
}

export class DiscoveryHttpAdapter {
  private readonly router: DiscoveryApiRouter;

  constructor(platform: DiscoveryQueryPlatform) {
    this.router = new DiscoveryApiRouter(platform);
  }

  async handle(request: DiscoveryHttpRequest): Promise<DiscoveryHttpResponse> {
    const access = resolveDiscoveryAccessTier(request.headers);
    const version = negotiateDiscoveryApiVersion(
      request.headers?.['x-er-api-version'] ?? request.path.match(/^\/(v\d+)/)?.[1],
    ).resolved;

    const matched = matchRoute(request.path);
    if (!matched) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Route not found: ${request.path}`,
            details: [],
            retryable: false,
          },
          meta: {
            version,
            requestId: `drq_${Date.now().toString(36)}`,
            timestamp: new Date().toISOString(),
          },
        },
      };
    }

    const params = {
      ...matched.params,
      ...request.queryString,
    };

    let discoveryQuery: DiscoveryQuery | undefined;
    if (matched.route === 'events.filter' || matched.route === 'events') {
      discoveryQuery = (request.body as { query?: DiscoveryQuery } | undefined)?.query;
    }

    const routerRequest: DiscoveryApiRouterRequest = {
      route: matched.route,
      version,
      params,
      query: discoveryQuery,
      requestId: request.headers?.['x-request-id'],
    };

    const result = await this.router.handle(routerRequest);
    const status = result.ok ? 200 : result.error.code === 'NOT_FOUND' ? 404 : result.error.code.startsWith('INVALID') ? 400 : 500;
    const cacheKey = result.ok
      ? result.meta.cacheKey ?? buildDiscoveryCacheKey({ version, route: matched.route, query: discoveryQuery, params })
      : buildDiscoveryCacheKey({ version, route: matched.route, params });

    const cacheHeaders = buildDiscoveryCacheHeaders(
      matched.route,
      cacheKey,
      result.ok ? result.meta.performance.cacheStatus : 'bypass',
    );

    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-ER-API-Version': version,
        'X-ER-Access-Tier': access.tier,
        ...cacheHeaders,
      },
      body: result,
    };
  }
}
