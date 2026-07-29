import type { Clock } from '@/core/clock/clock';
import type { DiscoverySourceTrustProvider } from '@/features/discovery/trust/discovery-source-trust';
import { resolveEventDiscoveryTrust } from '@/features/discovery/trust/discovery-source-trust';
import { systemClock } from '@/core/clock/system-clock';
import { discoveryDiversityService } from '@/features/events/discovery/discovery-diversity-service';
import { discoveryEligibilityResolver } from '@/features/events/discovery/discovery-eligibility-resolver';
import {
  discoveryRankingService,
  type DiscoverySurface as RankingSurface,
  type RankableEvent,
} from '@/features/events/discovery/discovery-ranking-service';
import { toEventLifecycleInput } from '@/features/events/lifecycle/event-lifecycle-from-event';
import { eventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';
import { isRecentlyAdded } from '@/features/events/status/recently-added-resolver';
import { calculateDistanceKm } from '@/features/location/utils/geo-distance';

import type { DiscoveryFilterContext } from '../domain/discovery-filter-types';
import {
  DEFAULT_DISCOVERY_PAGE_SIZE,
  MAX_DISCOVERY_PAGE_SIZE,
} from '../domain/discovery-pagination-types';
import type {
  DiscoveryQuery,
  DiscoveryQueryResult,
  DiscoveryResultItem,
  DiscoverySortField,
} from '../domain/discovery-query-types';
import { createDiscoveryFilterEngine } from '../filters/discovery-filter-engine';
import { buildDiscoveryFilterPredicates } from '../filters/discovery-filter-predicates';
import { parseDiscoveryCursor, sliceAfterCursor } from '../pagination/discovery-cursor';
import { planDiscoveryQuery } from '../query/discovery-query-planner';
import type { DiscoveryEventSource } from '../repository/discovery-event-source';
import { matchesDiscoverySearch } from '../search/discovery-search-matcher';
import {
  sortDiscoveryEvents,
  toDiscoverySortValue,
  type DiscoverySortableEvent,
} from '../sorting/discovery-sort-engine';

function resolveCanonicalId(
  event: Event,
  resolver?: (eventId: string) => string,
): string {
  const baseId = event.canonicalEventId ?? event.id;
  return resolver ? resolver(baseId) : baseId;
}

function toRankableEvent(
  event: Event,
  now: Date,
  canonicalId: (event: Event) => string,
  sourceTrust: number,
): RankableEvent | null {
  const lifecycleInput = toEventLifecycleInput(event);
  const lifecycle = eventLifecycleResolver.resolve(lifecycleInput, now);
  const eligibility = discoveryEligibilityResolver.resolve(event, now);

  if (!eligibility.eventsEligible) {
    return null;
  }
  if (lifecycle.status === 'cancelled' || lifecycle.status === 'ended' || lifecycle.status === 'archived') {
    return null;
  }
  if (lifecycle.status === 'postponed') {
    return null;
  }

  return {
    canonicalEventId: canonicalId(event),
    startDateTime: event.startDateTime,
    publishedAt: event.publishedAt ?? event.createdAt,
    city: event.city,
    genres: event.genres,
    eventQuality: event.imageUrl ? 70 : 50,
    sourceTrust,
    freshness: isRecentlyAdded({ publishedAt: event.publishedAt ?? event.createdAt }, now) ? 80 : 40,
    hasImage: Boolean(event.imageUrl),
    hasTickets: Boolean(event.ticketUrl),
    featured: false,
    cancelled: Boolean(event.cancelledAt),
  };
}

export interface DiscoveryEngineOptions {
  eventSource: DiscoveryEventSource;
  clock?: Clock;
  resolveCanonicalId?: (eventId: string) => string;
  displayMapper?: (event: Event) => EventDisplayModel;
  sourceTrustProvider?: DiscoverySourceTrustProvider;
}

function toRankingSurface(surface: DiscoveryQuery['surface']): RankingSurface {
  if (surface === 'venue_events' || surface === 'festival_events') {
    return 'events_list';
  }
  return surface;
}

export class DiscoveryEngine {
  constructor(private readonly options: DiscoveryEngineOptions) {}

  async query(query: DiscoveryQuery): Promise<DiscoveryQueryResult<Event>> {
    const sourceEvents = await this.options.eventSource.listDiscoverableEvents(
      planDiscoveryQuery(query).pushdown,
    );
    const resolvedEvents = sourceEvents instanceof Promise ? await sourceEvents : sourceEvents;
    const trustBySourceId = await this.resolveTrustBySourceId(resolvedEvents);
    return this.executeQuery(resolvedEvents, query, trustBySourceId);
  }

  querySync(query: DiscoveryQuery): DiscoveryQueryResult<Event> {
    const sourceEvents = this.options.eventSource.listDiscoverableEvents(
      planDiscoveryQuery(query).pushdown,
    );
    if (sourceEvents instanceof Promise) {
      throw new Error('DiscoveryEngine.querySync requires a synchronous event source.');
    }
    return this.executeQuery(sourceEvents, query);
  }

  private async resolveTrustBySourceId(events: Event[]): Promise<Map<string, number>> {
    if (!this.options.sourceTrustProvider) {
      return new Map();
    }
    const index = this.options.sourceTrustProvider.getTrustIndexForEvents(events);
    return index instanceof Promise ? await index : index;
  }

  private executeQuery(sourceEvents: Event[], query: DiscoveryQuery): DiscoveryQueryResult<Event>;
  private executeQuery(
    sourceEvents: Event[],
    query: DiscoveryQuery,
    trustBySourceId: Map<string, number>,
  ): DiscoveryQueryResult<Event>;
  private executeQuery(
    sourceEvents: Event[],
    query: DiscoveryQuery,
    trustBySourceId: Map<string, number> = new Map(),
  ): DiscoveryQueryResult<Event> {
    const now = (this.options.clock ?? systemClock).now();
    const canonicalId = (event: Event) =>
      resolveCanonicalId(event, this.options.resolveCanonicalId);
    const limit = Math.min(query.limit ?? DEFAULT_DISCOVERY_PAGE_SIZE, MAX_DISCOVERY_PAGE_SIZE);
    const sortField: DiscoverySortField = query.sortBy ?? 'relevance';

    const filterContext: DiscoveryFilterContext = { now };
    const filterEngine = createDiscoveryFilterEngine(
      buildDiscoveryFilterPredicates(query, filterContext),
    );

    let events = filterEngine.apply(sourceEvents);

    if (query.search?.text?.trim()) {
      events = events.filter((event) =>
        matchesDiscoverySearch(event, query.search!.text, {
          mode: query.search?.mode,
          locale: query.search?.locale,
          fuzzyThreshold: query.search?.fuzzyThreshold,
        }),
      );
    }

    const rankable = events
      .map((event) => {
        const rankableEvent = toRankableEvent(
          event,
          now,
          canonicalId,
          resolveEventDiscoveryTrust({ event, trustBySourceId }),
        );
        return rankableEvent ? { event, rankableEvent } : null;
      })
      .filter((entry): entry is { event: Event; rankableEvent: RankableEvent } => entry !== null);

    const ranked = discoveryRankingService.rank(
      rankable.map((entry) => entry.rankableEvent),
      {
        surface: toRankingSurface(query.surface),
        timestamp: now.toISOString(),
        city: query.location?.city ?? query.entities?.city,
        selectedGenres: query.entities?.genres,
      },
    );

    const scoreByCanonicalId = new Map(
      ranked.map((entry) => [entry.canonicalEventId, entry.score] as const),
    );

    let sortable: DiscoverySortableEvent[] = rankable.map(({ event }) => ({
      event,
      score: scoreByCanonicalId.get(canonicalId(event)),
      distanceKm:
        query.location?.latitude !== undefined && query.location.longitude !== undefined &&
        event.latitude !== undefined && event.longitude !== undefined
          ? calculateDistanceKm(
              query.location.latitude,
              query.location.longitude,
              event.latitude,
              event.longitude,
            )
          : undefined,
    }));

    if (query.diversify !== false && (sortField === 'relevance' || sortField === 'date')) {
      const diverse = discoveryDiversityService.diversify(
        sortable.map((item) => ({
          canonicalEventId: canonicalId(item.event),
          startDateTime: item.event.startDateTime,
          publishedAt: item.event.publishedAt,
          city: item.event.city,
          genres: item.event.genres,
          eventQuality: item.score ?? 0,
          sourceTrust: resolveEventDiscoveryTrust({ event: item.event, trustBySourceId }),
          freshness: 0,
          hasImage: Boolean(item.event.imageUrl),
          hasTickets: Boolean(item.event.ticketUrl),
          score: item.score ?? 0,
          organizer: item.event.organizer,
          organizerId: item.event.organizerId,
          venue: item.event.venue,
          venueId: item.event.venueId,
        })),
      );
      const order = new Map(diverse.map((entry, index) => [entry.canonicalEventId, index]));
      sortable = [...sortable].sort((left, right) => {
        const leftOrder = order.get(canonicalId(left.event)) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = order.get(canonicalId(right.event)) ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      });
    } else {
      sortable = sortDiscoveryEvents(sortable, {
        sortField,
        sortDirection: query.sortDirection,
        location: query.location,
        now,
      });
    }

    const cursorPayload = parseDiscoveryCursor(query.cursor);
    const sortableWithKeys = sortable.map((item) => ({
      ...item,
      eventId: item.event.id,
      canonicalEventId: canonicalId(item.event),
      sortValue: toDiscoverySortValue(item, sortField),
    }));

    const { page, hasMore, nextCursor } = sliceAfterCursor(sortableWithKeys, cursorPayload, limit);

    const items: DiscoveryResultItem<Event>[] = page.map((item, index) => ({
      event: item.event,
      score: item.score,
      distanceKm: item.distanceKm,
      rank: index + 1,
    }));

    return {
      items,
      nextCursor,
      hasMore,
      totalMatched: sortable.length,
    };
  }

  async queryDisplayModels(query: DiscoveryQuery): Promise<DiscoveryQueryResult<EventDisplayModel>> {
    const result = await this.query(query);
    const mapper = this.options.displayMapper ?? (await import('@/features/events/formatting/display-event')).toEventDisplayModel;
    return this.mapToDisplayModels(result, mapper);
  }

  queryDisplayModelsSync(query: DiscoveryQuery): DiscoveryQueryResult<EventDisplayModel> {
    const mapper = this.options.displayMapper ?? this.loadDisplayMapper();
    return this.mapToDisplayModels(this.querySync(query), mapper);
  }

  private loadDisplayMapper(): (event: Event) => EventDisplayModel {
    const { toEventDisplayModel } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/features/events/formatting/display-event') as typeof import('@/features/events/formatting/display-event');
    return toEventDisplayModel;
  }

  private mapToDisplayModels(
    result: DiscoveryQueryResult<Event>,
    toEventDisplayModel: (event: Event) => EventDisplayModel,
  ): DiscoveryQueryResult<EventDisplayModel> {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        event: toEventDisplayModel(item.event),
      })),
    };
  }
}
