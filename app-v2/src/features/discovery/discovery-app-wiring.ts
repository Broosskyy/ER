import type { SourceRecord } from '@/data/types/records';
import {
  adminSourceRepository,
  eventRepository,
  organizerRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { bindDiscoveryPlatform } from '@/features/discovery/discovery-platform-bindings';
import { InMemoryDiscoveryEventSource } from '@/features/discovery/repository/in-memory-discovery-event-source';
import { OptimizedDiscoveryEventSource } from '@/features/discovery/repository/optimized-discovery-event-source';
import { DiscoveryApiService } from '@/features/discovery/services/discovery-api-service';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import { createDiscoverySourceTrustProvider } from '@/features/discovery/trust/discovery-source-trust';
import { bindDiscoverableEventRepository } from '@/features/events/discovery/discovery-feed-helpers';

bindDiscoverableEventRepository(eventRepository);

const discoveryEngine = new DiscoveryEngine({
  eventSource: new OptimizedDiscoveryEventSource(new InMemoryDiscoveryEventSource()),
  resolveCanonicalId: (eventId) => eventRepository.resolveCanonicalId(eventId),
  sourceTrustProvider: createDiscoverySourceTrustProvider(async (sourceIds) => {
    const records = await Promise.all(sourceIds.map((id) => adminSourceRepository.getById(id)));
    return records.filter((record): record is SourceRecord => record !== null);
  }),
});

const discoveryApiService = new DiscoveryApiService(discoveryEngine);

bindDiscoveryPlatform(discoveryEngine, discoveryApiService, {
  eventRepository,
  venueRepository,
  organizerRepository,
});
