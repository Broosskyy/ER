import { toEventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';

import type { DiscoveryEventSource } from '../repository/discovery-event-source';
import type { DiscoveryQuery, DiscoveryQueryResult } from '../domain/discovery-query-types';

export interface DiscoveryEngineOptions {
  eventSource: DiscoveryEventSource;
  resolveCanonicalId?: (eventId: string) => string;
  displayMapper?: (event: Event) => EventDisplayModel;
}

function emptyResult<T>(): DiscoveryQueryResult<T> {
  return {
    items: [],
    totalMatched: 0,
    hasMore: false,
  };
}

export class DiscoveryEngine {
  constructor(private readonly options: DiscoveryEngineOptions) {}

  async query(query: DiscoveryQuery): Promise<DiscoveryQueryResult<Event>> {
    void query;
    const events = await Promise.resolve(this.options.eventSource.listDiscoverableEvents());
    return emptyResult<Event>();
  }

  querySync(query: DiscoveryQuery): DiscoveryQueryResult<Event> {
    void query;
    return emptyResult<Event>();
  }

  async queryDisplayModels(query: DiscoveryQuery): Promise<DiscoveryQueryResult<EventDisplayModel>> {
    void query;
    return emptyResult<EventDisplayModel>();
  }

  queryDisplayModelsSync(query: DiscoveryQuery): DiscoveryQueryResult<EventDisplayModel> {
    void query;
    return emptyResult<EventDisplayModel>();
  }
}
