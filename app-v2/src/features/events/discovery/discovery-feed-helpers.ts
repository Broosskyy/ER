import type { EventRepository } from '@/data/repositories/repositories';
import type { Event } from '@/features/events/types/event';

let discoverableEventRepository: EventRepository | undefined;

export function bindDiscoverableEventRepository(repository: EventRepository): void {
  discoverableEventRepository = repository;
}

/** Legacy discovery bridge — M2 runtime uses EventRepository summaries directly. */
export function getDiscoverablePublishedEvents(): Event[] {
  return [];
}
