import type { Event } from '@/features/events/types/event';

import type { DiscoverySourceQuery } from '../query/discovery-query-planner';
import type { DiscoveryEventSource } from './discovery-event-source';
import { InMemoryDiscoveryEventSource } from './in-memory-discovery-event-source';

function matchesPushdown(event: Event, query: DiscoverySourceQuery): boolean {
  if (query.venueId && event.venueId !== query.venueId) {
    return false;
  }
  if (query.organizerId && event.organizerId !== query.organizerId) {
    return false;
  }
  if (query.festivalEditionId && event.festivalEditionId !== query.festivalEditionId) {
    return false;
  }
  if (query.festivalId && event.festivalId !== query.festivalId) {
    return false;
  }
  if (query.city && event.city.toLowerCase() !== query.city.toLowerCase()) {
    return false;
  }
  if (query.startDateGte) {
    if (new Date(event.startDateTime).getTime() < new Date(query.startDateGte).getTime()) {
      return false;
    }
  }
  if (query.startDateLte) {
    if (new Date(event.startDateTime).getTime() > new Date(query.startDateLte).getTime()) {
      return false;
    }
  }
  return true;
}

export class OptimizedDiscoveryEventSource implements DiscoveryEventSource {
  constructor(private readonly delegate: DiscoveryEventSource = new InMemoryDiscoveryEventSource()) {}

  listDiscoverableEvents(query?: DiscoverySourceQuery): Event[] | Promise<Event[]> {
    const events = this.delegate.listDiscoverableEvents(query);
    if (!query || Object.keys(query).length === 0) {
      return events;
    }

    if (events instanceof Promise) {
      return events.then((resolved) => resolved.filter((event) => matchesPushdown(event, query)));
    }

    return events.filter((event) => matchesPushdown(event, query));
  }
}
