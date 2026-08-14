import type { Event } from '@/features/events/types/event';

import type { DiscoveryEntityReaders } from './discovery-query-platform';

export function createRegistryDiscoveryEntityReaders(input: {
  getEventById: (id: string) => Event | undefined;
  getPublishedEvents: () => Event[];
}): DiscoveryEntityReaders {
  return {
    getEventById: (id) => input.getEventById(id),
    getVenueById: async () => null,
    getOrganizerById: async () => null,
    getFestivalById: async () => null,
  };
}
