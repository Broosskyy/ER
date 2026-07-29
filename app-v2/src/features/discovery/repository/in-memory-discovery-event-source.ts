import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';

import type { DiscoverySourceQuery } from '../query/discovery-query-planner';
import type { DiscoveryEventSource } from './discovery-event-source';

export class InMemoryDiscoveryEventSource implements DiscoveryEventSource {
  listDiscoverableEvents(_query?: DiscoverySourceQuery) {
    return getDiscoverablePublishedEvents();
  }
}
