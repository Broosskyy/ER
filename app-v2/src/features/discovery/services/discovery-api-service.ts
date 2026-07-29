import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventFilters } from '@/features/search/constants';

import type { DiscoveryQuery, DiscoveryQueryResult } from '../domain/discovery-query-types';
import type { DiscoveryEngine } from './discovery-engine';
import { mapEventFiltersToDiscoveryQuery } from '../utils/map-event-filters-to-discovery-query';

export class DiscoveryApiService {
  constructor(private readonly discoveryEngine: DiscoveryEngine) {}

  async searchEvents(query: DiscoveryQuery): Promise<DiscoveryQueryResult> {
    return this.discoveryEngine.query(query);
  }

  async searchDisplayEvents(
    query: DiscoveryQuery,
  ): Promise<DiscoveryQueryResult<EventDisplayModel>> {
    return this.discoveryEngine.queryDisplayModels(query);
  }

  async searchWithLegacyFilters(
    filters: EventFilters,
    options?: { surface?: DiscoveryQuery['surface']; limit?: number; cursor?: DiscoveryQuery['cursor'] },
  ): Promise<DiscoveryQueryResult<EventDisplayModel>> {
    const query = mapEventFiltersToDiscoveryQuery(filters, {
      surface: options?.surface ?? 'search_events',
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return this.searchDisplayEvents(query);
  }

  searchWithLegacyFiltersSync(
    filters: EventFilters,
    options?: { surface?: DiscoveryQuery['surface']; limit?: number; cursor?: DiscoveryQuery['cursor'] },
  ): DiscoveryQueryResult<EventDisplayModel> {
    const query = mapEventFiltersToDiscoveryQuery(filters, {
      surface: options?.surface ?? 'search_events',
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return this.discoveryEngine.queryDisplayModelsSync(query);
  }
}
