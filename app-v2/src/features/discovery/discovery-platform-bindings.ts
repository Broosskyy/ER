import type { EventRepository, OrganizerRepository, VenueRepository } from '@/data/repositories/repositories';
import { DiscoveryHttpAdapter } from '@/features/discovery/api/http/discovery-http-adapter';
import { createRegistryDiscoveryEntityReaders } from '@/features/discovery/api/services/discovery-entity-readers';
import { DiscoveryQueryPlatform } from '@/features/discovery/api/services/discovery-query-platform';
import { bindDiscoveryServices } from '@/features/discovery/discovery-runtime';
import type { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import type { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import type { Event } from '@/features/events/types/event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface DiscoveryPlatformDependencies {
  eventRepository: EventRepository;
  venueRepository: VenueRepository;
  organizerRepository: OrganizerRepository;
}

export function bindDiscoveryPlatform(
  discoveryEngine: DiscoveryEngine,
  discoveryApiService: DiscoveryApiService,
  deps: DiscoveryPlatformDependencies,
): { queryPlatform: DiscoveryQueryPlatform; httpAdapter: DiscoveryHttpAdapter } {
  const queryPlatform = new DiscoveryQueryPlatform({
    discoveryApi: discoveryApiService,
    entityReaders: createRegistryDiscoveryEntityReaders({
      getEventById: (id) => deps.eventRepository.getEventById(id),
      getVenueById: (id) => deps.venueRepository.getById(id),
      getOrganizerById: (id) => deps.organizerRepository.getById(id),
      getPublishedEvents: () => getDiscoverablePublishedEvents(),
    }),
    mapEventToDisplay: (event: Event): EventDisplayModel => loadEventDisplayModel(event),
  });

  const httpAdapter = new DiscoveryHttpAdapter(queryPlatform);
  bindDiscoveryServices(discoveryEngine, discoveryApiService, queryPlatform, httpAdapter);

  return { queryPlatform, httpAdapter };
}

function loadEventDisplayModel(event: Event): EventDisplayModel {
  const { toEventDisplayModel } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/events/formatting/display-event') as typeof import('@/features/events/formatting/display-event');
  return toEventDisplayModel(event);
}
