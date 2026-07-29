import type { OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { FestivalRecord } from '@/features/events/domain/festival-foundation';
import type { Event } from '@/features/events/types/event';

import type { DiscoveryEntityReaders } from './discovery-query-platform';

export function createRegistryDiscoveryEntityReaders(input: {
  getEventById: (id: string) => Event | undefined;
  getVenueById: (id: string) => Promise<VenueRecord | null>;
  getOrganizerById: (id: string) => Promise<OrganizerRecord | null>;
  getPublishedEvents: () => Event[];
}): DiscoveryEntityReaders {
  return {
    getEventById: (id) => input.getEventById(id),
    getVenueById: (id) => input.getVenueById(id),
    getOrganizerById: (id) => input.getOrganizerById(id),
    getFestivalById: async (id) => deriveFestivalFromEvents(id, input.getPublishedEvents()),
  };
}

function deriveFestivalFromEvents(festivalId: string, events: Event[]): FestivalRecord | null {
  const festivalEvents = events.filter((event) => event.festivalId === festivalId);
  if (festivalEvents.length === 0) {
    return null;
  }

  const first = festivalEvents[0]!;
  const now = new Date().toISOString();

  return {
    id: festivalId,
    slug: festivalId,
    name: first.title.includes('Festival') ? first.title : `${first.city} Festival`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}
