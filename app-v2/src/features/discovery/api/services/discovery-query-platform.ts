import type { OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { FestivalRecord } from '@/features/events/domain/festival-foundation';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';

import type { DiscoveryApiAppliedFilters, DiscoveryApiPagination, DiscoveryApiPerformanceMeta, DiscoveryApiResponse } from '../domain/discovery-api-envelope';
import { createDiscoveryApiResponse } from '../domain/discovery-api-envelope';
import { DiscoveryApiError } from '../domain/discovery-api-errors';
import { isInternalPublicEvent } from '@/features/events/discovery/internal-event-eligibility';
import type { DiscoveryApiVersion } from '../domain/discovery-api-version';
import { DEFAULT_DISCOVERY_API_VERSION } from '../domain/discovery-api-version';
import type { DiscoveryQuery, DiscoveryQueryResult } from '../../domain/discovery-query-types';
import type { DiscoveryApiService } from '../../services/discovery-api-service';
import { buildDiscoveryCacheKey } from '../cache/discovery-cache-key';
import { validateDiscoveryQuery, assertDiscoveryEntityId } from '../validation/discovery-api-validator';
import {
  buildEntityEventsQuery,
  buildNearbyQuery,
  buildNewlyAddedQuery,
  buildNextWeekQuery,
  buildSearchQuery,
  buildThisWeekQuery,
  buildTodayQuery,
  buildTrendingQuery,
  buildUpcomingHighlightsQuery,
  buildWeekendQuery,
} from '../discovery-query-presets';

export interface DiscoveryEntityReaders {
  getEventById(id: string): Event | undefined | Promise<Event | undefined>;
  getVenueById(id: string): VenueRecord | null | Promise<VenueRecord | null>;
  getOrganizerById(id: string): OrganizerRecord | null | Promise<OrganizerRecord | null>;
  getFestivalById(id: string): FestivalRecord | null | Promise<FestivalRecord | null>;
}

export interface DiscoveryQueryPlatformOptions {
  discoveryApi: DiscoveryApiService;
  entityReaders: DiscoveryEntityReaders;
  mapEventToDisplay: (event: Event) => EventDisplayModel;
  loadEventOrigins?: (eventId: string) => Promise<DiscoveryEventDetailData['origins']>;
  createRequestId?: () => string;
}

export interface DiscoveryEventsListData {
  items: DiscoveryQueryResult<EventDisplayModel>['items'];
}

export interface DiscoveryEventDetailData {
  event: EventDisplayModel;
  origins?: Array<{
    id: string;
    sourceId: string;
    platform?: string;
    role: string;
    ticketUrl?: string;
    eventUrl?: string;
    syncStatus: string;
    isPrimary: boolean;
    isActive: boolean;
  }>;
}

export interface DiscoveryEntityDetailData<TEntity> {
  entity: TEntity;
}

export interface DiscoveryEntityEventsData<TEntity> {
  entity: TEntity;
  events: DiscoveryQueryResult<EventDisplayModel>['items'];
}

function createRequestId(): string {
  return `drq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toAppliedFilters(query: DiscoveryQuery): DiscoveryApiAppliedFilters {
  return {
    date: query.date,
    entities: query.entities,
    location: query.location,
    price: query.price,
    venueEnvironment: query.venueEnvironment,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };
}

function toPagination(result: DiscoveryQueryResult<unknown>): DiscoveryApiPagination {
  return {
    limit: result.items.length,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
    totalMatched: result.totalMatched,
  };
}

export class DiscoveryQueryPlatform {
  constructor(private readonly options: DiscoveryQueryPlatformOptions) {}

  async queryEvents(
    query: DiscoveryQuery,
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    return this.executeQueryRoute('events', query, version);
  }

  async getEventDetail(
    id: string,
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
    options: { includeOrigins?: boolean } = {},
  ): Promise<DiscoveryApiResponse<DiscoveryEventDetailData>> {
    const requestId = this.options.createRequestId?.() ?? createRequestId();
    const startedAt = Date.now();
    const eventId = assertDiscoveryEntityId(id, 'id');
    const event = await this.options.entityReaders.getEventById(eventId);

    if (!event) {
      throw new DiscoveryApiError('Event not found.', {
        code: 'NOT_FOUND',
        details: [{ field: 'id', code: 'NOT_FOUND', message: `Event ${eventId} was not found.` }],
      });
    }

    if (isInternalPublicEvent(event)) {
      throw new DiscoveryApiError('Event not found.', {
        code: 'NOT_FOUND',
        details: [{ field: 'id', code: 'NOT_FOUND', message: `Event ${eventId} is not publicly available.` }],
      });
    }

    const origins =
      options.includeOrigins && this.options.loadEventOrigins
        ? await this.options.loadEventOrigins(eventId)
        : undefined;

    return createDiscoveryApiResponse({
      data: {
        event: this.options.mapEventToDisplay(event),
        ...(origins ? { origins } : {}),
      },
      version,
      requestId,
      performance: this.buildPerformance(startedAt, 1, 1, 'memory'),
      cacheKey: buildDiscoveryCacheKey({
        version,
        route: 'events.detail',
        params: { id: eventId, includeOrigins: options.includeOrigins === true },
      }),
    });
  }

  async queryNearby(
    params: { latitude: number; longitude: number; radiusKm?: number; limit?: number; cursor?: DiscoveryQuery['cursor'] },
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildNearbyQuery(params);
    return this.executeQueryRoute('events.nearby', query, version, params);
  }

  async queryTrending(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildTrendingQuery(params);
    return this.executeQueryRoute('events.trending', query, version, params);
  }

  async queryToday(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildTodayQuery(params);
    return this.executeQueryRoute('events.today', query, version, params);
  }

  async queryWeekend(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildWeekendQuery(params);
    return this.executeQueryRoute('events.weekend', query, version, params);
  }

  async queryThisWeek(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildThisWeekQuery(params);
    return this.executeQueryRoute('events.filter', query, version, params);
  }

  async queryNextWeek(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildNextWeekQuery(params);
    return this.executeQueryRoute('events.filter', query, version, params);
  }

  async queryNewlyAdded(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildNewlyAddedQuery(params);
    return this.executeQueryRoute('events.filter', query, version, params);
  }

  async queryUpcomingHighlights(
    params: { city?: string; limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const query = buildUpcomingHighlightsQuery(params);
    return this.executeQueryRoute('events.filter', query, version, params);
  }

  async searchEvents(
    params: { text: string; limit?: number; cursor?: DiscoveryQuery['cursor']; locale?: 'de' | 'en'; city?: string },
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    if (!params.text?.trim()) {
      throw new DiscoveryApiError('Search text is required.', {
        code: 'INVALID_QUERY',
        details: [{ field: 'text', code: 'INVALID_QUERY', message: 'text is required.' }],
      });
    }
    const query = buildSearchQuery(params.text, params);
    return this.executeQueryRoute('events.search', query, version, params);
  }

  async filterEvents(
    query: DiscoveryQuery,
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    return this.executeQueryRoute('events.filter', query, version);
  }

  async getVenueDetail(
    id: string,
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityDetailData<VenueRecord>>> {
    return this.getEntityDetail('venues.detail', id, () => this.options.entityReaders.getVenueById(id), version);
  }

  async getVenueEvents(
    id: string,
    options: { limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityEventsData<VenueRecord>>> {
    return this.getEntityEvents('venues.events', id, 'venue_events', { venueId: id }, options, version);
  }

  async getOrganizerDetail(
    id: string,
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityDetailData<OrganizerRecord>>> {
    return this.getEntityDetail('organizers.detail', id, () => this.options.entityReaders.getOrganizerById(id), version);
  }

  async getOrganizerEvents(
    id: string,
    options: { limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityEventsData<OrganizerRecord>>> {
    return this.getEntityEvents('organizers.events', id, 'organizer_events', { organizerId: id }, options, version);
  }

  async getFestivalDetail(
    id: string,
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityDetailData<FestivalRecord>>> {
    return this.getEntityDetail('festivals.detail', id, () => this.options.entityReaders.getFestivalById(id), version);
  }

  async getFestivalEvents(
    id: string,
    options: { limit?: number; cursor?: DiscoveryQuery['cursor'] } = {},
    version: DiscoveryApiVersion = DEFAULT_DISCOVERY_API_VERSION,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityEventsData<FestivalRecord>>> {
    return this.getEntityEvents('festivals.events', id, 'festival_events', { festivalId: id }, options, version);
  }

  private async executeQueryRoute(
    route: string,
    query: DiscoveryQuery,
    version: DiscoveryApiVersion,
    params?: Record<string, unknown>,
  ): Promise<DiscoveryApiResponse<DiscoveryEventsListData>> {
    const requestId = this.options.createRequestId?.() ?? createRequestId();
    const startedAt = Date.now();
    validateDiscoveryQuery(query);

    const result = await this.options.discoveryApi.searchDisplayEvents(query);

    return createDiscoveryApiResponse({
      data: { items: result.items },
      version,
      requestId,
      pagination: toPagination(result),
      surface: query.surface,
      filters: toAppliedFilters(query),
      performance: this.buildPerformance(startedAt, result.totalMatched, result.items.length, 'hybrid'),
      cacheKey: buildDiscoveryCacheKey({ version, route, query, params }),
    });
  }

  private async getEntityDetail<TEntity>(
    route: string,
    id: string,
    loader: () => TEntity | null | Promise<TEntity | null>,
    version: DiscoveryApiVersion,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityDetailData<TEntity>>> {
    const requestId = this.options.createRequestId?.() ?? createRequestId();
    const startedAt = Date.now();
    const entityId = assertDiscoveryEntityId(id, 'id');
    const entity = await loader();

    if (!entity) {
      throw new DiscoveryApiError('Entity not found.', {
        code: 'NOT_FOUND',
        details: [{ field: 'id', code: 'NOT_FOUND', message: `Entity ${entityId} was not found.` }],
      });
    }

    return createDiscoveryApiResponse({
      data: { entity },
      version,
      requestId,
      performance: this.buildPerformance(startedAt, 1, 1, 'database'),
      cacheKey: buildDiscoveryCacheKey({ version, route, params: { id: entityId } }),
    });
  }

  private async getEntityEvents<TEntity>(
    route: string,
    id: string,
    surface: DiscoveryQuery['surface'],
    entities: DiscoveryQuery['entities'],
    options: { limit?: number; cursor?: DiscoveryQuery['cursor'] },
    version: DiscoveryApiVersion,
  ): Promise<DiscoveryApiResponse<DiscoveryEntityEventsData<TEntity>>> {
    const requestId = this.options.createRequestId?.() ?? createRequestId();
    const startedAt = Date.now();
    const entityId = assertDiscoveryEntityId(id, 'id');
    const loader =
      surface === 'venue_events'
        ? () => this.options.entityReaders.getVenueById(entityId)
        : surface === 'organizer_events'
          ? () => this.options.entityReaders.getOrganizerById(entityId)
          : () => this.options.entityReaders.getFestivalById(entityId);

    const entity = await loader();
    if (!entity) {
      throw new DiscoveryApiError('Entity not found.', {
        code: 'NOT_FOUND',
        details: [{ field: 'id', code: 'NOT_FOUND', message: `Entity ${entityId} was not found.` }],
      });
    }

    const query = buildEntityEventsQuery(surface, entities, options);
    validateDiscoveryQuery(query);
    const result = await this.options.discoveryApi.searchDisplayEvents(query);

    return createDiscoveryApiResponse({
      data: { entity, events: result.items },
      version,
      requestId,
      pagination: toPagination(result),
      surface,
      filters: toAppliedFilters(query),
      performance: this.buildPerformance(startedAt, result.totalMatched, result.items.length, 'hybrid'),
      cacheKey: buildDiscoveryCacheKey({ version, route, query, params: { id: entityId } }),
    }) as DiscoveryApiResponse<DiscoveryEntityEventsData<TEntity>>;
  }

  private buildPerformance(
    startedAt: number,
    eventsScanned: number,
    eventsReturned: number,
    source: DiscoveryApiPerformanceMeta['source'],
  ): DiscoveryApiPerformanceMeta {
    return {
      durationMs: Date.now() - startedAt,
      source,
      cacheStatus: 'miss',
      eventsScanned,
      eventsReturned,
    };
  }
}
