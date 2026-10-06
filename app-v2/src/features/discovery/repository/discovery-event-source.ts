import type { Event } from '@/features/events/types/event';
import type { DiscoverySourceQuery } from '../query/discovery-query-planner';

export interface DiscoveryEventSource {
  listDiscoverableEvents(query?: DiscoverySourceQuery): Event[] | Promise<Event[]>;
}
