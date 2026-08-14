import type { EventRepository } from '@/data/repositories/repositories';
import type { Event } from '@/features/events/types/event';

let discoverableEventRepository: EventRepository | undefined;

export function bindDiscoverableEventRepository(repository: EventRepository): void {
  discoverableEventRepository = repository;
}

function getEventRepository(): EventRepository {
  if (!discoverableEventRepository) {
    throw new Error('Discoverable event repository is not initialized.');
  }
  return discoverableEventRepository;
}

export function getDiscoverablePublishedEvents(): Event[] {
  return getEventRepository()
    .getPublishedEvents()
    .filter((event) => event.status === 'published');
}
