import './bootstrap-ops-supabase';

import { discoveryEngine, importEventPublishService } from '@/data/repositories/registry';
import { mapEventFiltersToDiscoveryQuery } from '@/features/discovery/utils/map-event-filters-to-discovery-query';
import { toEventDisplayModel } from '@/features/events/formatting/display-event';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import { buildUniversalSearchResults } from '@/features/search/services/universal-search-service';

const SAMPLE_QUERIES = ['WESTBAM', 'DEXPHASE', 'Lehmann', 'Proton', 'Köln', 'Stuttgart', 'Techno'] as const;

const SAMPLE_EVENT_TITLES = [
  'WESTBAM - SAVE THE RAVE 2027',
  'FATALITY pres. DEXPHASE',
  'TECHNO DAMPFER Köln w/ Saltysis',
] as const;

async function countDiscoverableEvents(): Promise<number> {
  const result = await discoveryEngine.query(
    mapEventFiltersToDiscoveryQuery({
      ...DEFAULT_EVENT_FILTERS,
      query: '',
    }),
  );
  return result.totalMatched;
}

async function searchGlobal(query: string) {
  const filters = { ...DEFAULT_EVENT_FILTERS, query };
  const discoveryQuery = mapEventFiltersToDiscoveryQuery(filters);
  const result = await discoveryEngine.query(discoveryQuery);

  const grouped = await buildUniversalSearchResults({
    query,
    filters,
    events: result.items.map((item) => toEventDisplayModel(item.event)),
    sourceEvents: result.items.map((item) => item.event),
    totalEventMatches: result.totalMatched,
    hasMoreEvents: result.hasMore,
    entityReaders: {
      listPublishedArtists: async () => [],
      listVenues: async () => [],
      listOrganizers: async () => [],
    },
  });

  return {
    scope: grouped.scope,
    appliedFilters: grouped.appliedFilters,
    eventCount: grouped.events.length,
    artistCount: grouped.artists.length,
    venueCount: grouped.venues.length,
    organizerCount: grouped.organizers.length,
    cityCount: grouped.cities.length,
    genreCount: grouped.genres.length,
    sampleEventTitles: grouped.events.slice(0, 5).map((event) => event.title),
  };
}

async function traceSampleEvents() {
  const all = await discoveryEngine.query(mapEventFiltersToDiscoveryQuery(DEFAULT_EVENT_FILTERS));
  const titles = new Set(all.items.map((item) => item.event.title));

  return SAMPLE_EVENT_TITLES.map((title) => ({
    title,
    discoverable: [...titles].some((candidate) => candidate.toLowerCase().includes(title.split(' ')[0]!.toLowerCase())),
    matchedTitles: [...titles].filter((candidate) =>
      candidate.toLowerCase().includes(title.split(' ')[0]!.toLowerCase()),
    ),
  }));
}

async function main(): Promise<void> {
  await importEventPublishService.refreshConsumerFeed();

  const globalDiscoverable = await countDiscoverableEvents();
  const queryReports = Object.fromEntries(
    await Promise.all(SAMPLE_QUERIES.map(async (query) => [query, await searchGlobal(query)])),
  );
  const samples = await traceSampleEvents();

  console.log(
    JSON.stringify(
      {
        phase: '4.2',
        globalDiscoverableEventCount: globalDiscoverable,
        searchDefaults: {
          locationScope: DEFAULT_EVENT_FILTERS.locationScope,
          city: DEFAULT_EVENT_FILTERS.city,
        },
        queryReports,
        sampleEventTraces: samples,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
