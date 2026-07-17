import { eventRepository } from '@/repositories/eventRepository';
import { mapEntityToEvent } from '@/utils/entityToEventMapper';
import { Event } from '@/types/event';
import { ServiceResult } from './types';

export const PUBLIC_FEED_PAGE_SIZE = 20;

export async function fetchPublishedFeedPage(
  offset = 0,
  limit = PUBLIC_FEED_PAGE_SIZE
): Promise<ServiceResult<{ events: Event[]; hasMore: boolean }>> {
  const result = await eventRepository.findMany(
    { status: 'published' },
    { limit: limit + 1, offset, orderBy: 'start_datetime', ascending: true }
  );

  if (result.offline) return { data: null, error: null, offline: true };
  if (result.error) return { data: null, error: result.error, offline: false };

  const entities = result.data ?? [];
  const hasMore = entities.length > limit;
  const page = hasMore ? entities.slice(0, limit) : entities;

  return {
    data: { events: page.map(mapEntityToEvent), hasMore },
    error: null,
    offline: false,
  };
}

/** Loads all published events — used for demo fallback merge and legacy callers. */
export async function fetchAllPublishedEvents(): Promise<ServiceResult<Event[]>> {
  const result = await eventRepository.findMany(
    { status: 'published' },
    { limit: 500, orderBy: 'start_datetime', ascending: true }
  );

  if (result.offline) return { data: null, error: null, offline: true };
  if (result.error) return { data: null, error: result.error, offline: false };

  return {
    data: (result.data ?? []).map(mapEntityToEvent),
    error: null,
    offline: false,
  };
}
