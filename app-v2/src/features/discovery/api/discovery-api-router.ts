import type { DiscoveryQuery } from '../domain/discovery-query-types';
import { DiscoveryApiError } from './domain/discovery-api-errors';
import { createDiscoveryApiErrorResponse } from './domain/discovery-api-envelope';
import type { DiscoveryApiResult } from './domain/discovery-api-envelope';
import type { DiscoveryApiRoute, DiscoveryApiRouteRequest } from './domain/discovery-api-route-types';
import { negotiateDiscoveryApiVersion } from './domain/discovery-api-version';
import type { DiscoveryQueryPlatform } from './services/discovery-query-platform';

export interface DiscoveryApiRouterRequest {
  route: DiscoveryApiRoute;
  version?: string;
  params?: Record<string, unknown>;
  query?: DiscoveryQuery;
  requestId?: string;
}

export class DiscoveryApiRouter {
  constructor(private readonly platform: DiscoveryQueryPlatform) {}

  async handle<TData>(request: DiscoveryApiRouterRequest): Promise<DiscoveryApiResult<TData>> {
    const requestId = request.requestId ?? `drq_${Date.now().toString(36)}`;
    const versionNegotiation = negotiateDiscoveryApiVersion(request.version);

    try {
      const routeRequest: DiscoveryApiRouteRequest = {
        context: {
          route: request.route,
          version: versionNegotiation.resolved,
          accessTier: 'public',
          requestId,
        },
        params: request.params ?? {},
        query: request.query,
      };

      const response = await this.dispatchRoute(routeRequest);
      return response as DiscoveryApiResult<TData>;
    } catch (error) {
      if (error instanceof DiscoveryApiError) {
        return createDiscoveryApiErrorResponse(
          {
            code: error.code,
            message: error.message,
            details: error.details,
            retryable: error.retryable,
          },
          { version: versionNegotiation.resolved, requestId },
        );
      }

      return createDiscoveryApiErrorResponse(
        {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected discovery API error.',
          details: [],
          retryable: true,
        },
        { version: versionNegotiation.resolved, requestId },
      );
    }
  }

  private dispatchRoute(routeRequest: DiscoveryApiRouteRequest) {
    const version = negotiateDiscoveryApiVersion(routeRequest.context.version).resolved;
    const params = routeRequest.params;

    switch (routeRequest.context.route) {
      case 'events':
        return this.platform.queryEvents(routeRequest.query ?? { surface: 'events_list', sortBy: 'date' }, version);
      case 'events.detail':
        return this.platform.getEventDetail(String(params.id), version, {
          includeOrigins: params.includeOrigins === true || params.includeOrigins === 'true',
        });
      case 'events.nearby':
        return this.platform.queryNearby(
          {
            latitude: Number(params.latitude),
            longitude: Number(params.longitude),
            radiusKm: params.radiusKm !== undefined ? Number(params.radiusKm) : undefined,
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      case 'events.trending':
        return this.platform.queryTrending(
          {
            city: params.city as string | undefined,
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      case 'events.today':
        return this.platform.queryToday(
          {
            city: params.city as string | undefined,
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      case 'events.weekend':
        return this.platform.queryWeekend(
          {
            city: params.city as string | undefined,
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      case 'events.search':
        return this.platform.searchEvents(
          {
            text: String(params.text ?? ''),
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
            locale: params.locale as 'de' | 'en' | undefined,
            city: params.city as string | undefined,
          },
          version,
        );
      case 'events.filter':
        if (!routeRequest.query) {
          throw new DiscoveryApiError('Discovery query is required for filter route.', {
            code: 'INVALID_QUERY',
          });
        }
        return this.platform.filterEvents(routeRequest.query, version);
      case 'venues.detail':
        return this.platform.getVenueDetail(String(params.id), version);
      case 'venues.events':
        return this.platform.getVenueEvents(
          String(params.id),
          {
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      case 'organizers.detail':
        return this.platform.getOrganizerDetail(String(params.id), version);
      case 'organizers.events':
        return this.platform.getOrganizerEvents(
          String(params.id),
          {
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      case 'festivals.detail':
        return this.platform.getFestivalDetail(String(params.id), version);
      case 'festivals.events':
        return this.platform.getFestivalEvents(
          String(params.id),
          {
            limit: params.limit !== undefined ? Number(params.limit) : undefined,
            cursor: params.cursor as DiscoveryQuery['cursor'],
          },
          version,
        );
      default:
        throw new DiscoveryApiError(`Unsupported route: ${routeRequest.context.route}`, {
          code: 'INVALID_QUERY',
        });
    }
  }
}
