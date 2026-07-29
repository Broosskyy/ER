import { buildDiscoveryCacheKey } from '@/features/discovery/api/cache/discovery-cache-key';
import { resolveDiscoveryCachePolicy } from '@/features/discovery/api/cache/discovery-cache-policy';
import { DEFAULT_DISCOVERY_API_VERSION } from '@/features/discovery/api/domain/discovery-api-version';
import { buildSimilarEventsQuery } from '@/features/discovery/api/discovery-query-presets';
import { DiscoveryApiError } from '@/features/discovery/api/domain/discovery-api-errors';
import { getDiscoveryQueryPlatform } from '@/features/discovery/discovery-runtime';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { toEventCardViewModel } from '@/features/events/formatting/event-card-view-model';

import { trackEventDetailTelemetry } from './event-detail-telemetry';

export interface EventDetailLoadResult {
  event: EventDisplayModel;
  durationMs: number;
  fromCache: boolean;
}

export interface SimilarEventsLoadResult {
  events: ReturnType<typeof toEventCardViewModel>[];
  durationMs: number;
}

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

const detailCache = new Map<string, CacheEntry<EventDisplayModel>>();
const inflightDetailRequests = new Map<string, Promise<EventDetailLoadResult>>();
const inflightSimilarRequests = new Map<string, Promise<SimilarEventsLoadResult>>();

const DETAIL_POLICY = resolveDiscoveryCachePolicy('events.detail');

function readCache(eventId: string): EventDisplayModel | undefined {
  const entry = detailCache.get(eventId);
  if (!entry) {
    return undefined;
  }

  const ageSeconds = (Date.now() - entry.cachedAt) / 1000;
  const maxAge = DETAIL_POLICY.ttlSeconds + (DETAIL_POLICY.staleWhileRevalidateSeconds ?? 0);
  if (ageSeconds > maxAge) {
    detailCache.delete(eventId);
    return undefined;
  }

  return entry.value;
}

function writeCache(eventId: string, event: EventDisplayModel): void {
  detailCache.set(eventId, { value: event, cachedAt: Date.now() });
}

export async function loadEventDetail(
  eventId: string,
  options: { bypassCache?: boolean } = {},
): Promise<EventDetailLoadResult> {
  if (!eventId.trim()) {
    throw new DiscoveryApiError('Event id is required.', { code: 'INVALID_QUERY' });
  }

  const cached = !options.bypassCache ? readCache(eventId) : undefined;
  if (cached) {
    trackEventDetailTelemetry('detail_load_complete', { eventId, durationMs: 0 });
    return { event: cached, durationMs: 0, fromCache: true };
  }

  const requestKey = buildDiscoveryCacheKey({
    version: DEFAULT_DISCOVERY_API_VERSION,
    route: 'events.detail',
    params: { id: eventId },
  });

  if (!options.bypassCache && inflightDetailRequests.has(requestKey)) {
    return inflightDetailRequests.get(requestKey)!;
  }

  trackEventDetailTelemetry('detail_load_start', { eventId });
  const startedAt = Date.now();

  const request = (async () => {
    const platform = getDiscoveryQueryPlatform();
    const response = await platform.getEventDetail(eventId);
    const event = response.data.event;
    writeCache(eventId, event);

    const durationMs = response.meta.performance.durationMs ?? Date.now() - startedAt;
    trackEventDetailTelemetry('detail_load_complete', { eventId, durationMs });

    return { event, durationMs, fromCache: false };
  })()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Event konnte nicht geladen werden.';
      trackEventDetailTelemetry('detail_load_error', { eventId, error: message });
      throw error;
    })
    .finally(() => {
      inflightDetailRequests.delete(requestKey);
    });

  inflightDetailRequests.set(requestKey, request);
  return request;
}

export async function loadSimilarEvents(
  event: EventDisplayModel,
  options: { bypassCache?: boolean; limit?: number } = {},
): Promise<SimilarEventsLoadResult> {
  const requestKey = buildDiscoveryCacheKey({
    version: DEFAULT_DISCOVERY_API_VERSION,
    route: 'events.similar',
    params: { id: event.id, genres: event.genres, city: event.city },
  });

  if (!options.bypassCache && inflightSimilarRequests.has(requestKey)) {
    return inflightSimilarRequests.get(requestKey)!;
  }

  const startedAt = Date.now();
  const request = (async () => {
    const platform = getDiscoveryQueryPlatform();
    const query = buildSimilarEventsQuery(event, { limit: options.limit ?? 6, city: event.city });
    const response = await platform.filterEvents(query);
    const events = response.data.items
      .map((item) => item.event)
      .filter((candidate) => candidate.id !== event.id)
      .slice(0, options.limit ?? 6)
      .map((candidate) => toEventCardViewModel(candidate));

    return {
      events,
      durationMs: response.meta.performance.durationMs ?? Date.now() - startedAt,
    };
  })().finally(() => {
    inflightSimilarRequests.delete(requestKey);
  });

  inflightSimilarRequests.set(requestKey, request);
  return request;
}

export function clearEventDetailCache(): void {
  detailCache.clear();
  inflightDetailRequests.clear();
  inflightSimilarRequests.clear();
}

export function getCachedEventDetail(eventId: string): EventDisplayModel | undefined {
  return readCache(eventId);
}
