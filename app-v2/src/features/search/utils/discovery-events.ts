import { getDiscoveryApiService } from '@/features/discovery/discovery-runtime';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { loadDiscoverySearchResults } from '@/features/search/feed/discovery-search-client';
import type { EventFilters } from '@/features/search/constants';

/** Shared discovery query for grid surfaces — prefer useDiscoverySearch in UI. */
export function getDiscoveryEvents(filters: EventFilters): EventDisplayModel[] {
  const result = getDiscoveryApiService().searchWithLegacyFiltersSync(filters, {
    surface: 'search_events',
  });
  return result.items.map((item) => item.event);
}

export async function getDiscoveryEventsAsync(filters: EventFilters): Promise<EventDisplayModel[]> {
  const result = await loadDiscoverySearchResults(filters, { limit: 200 });
  return result.events;
}
