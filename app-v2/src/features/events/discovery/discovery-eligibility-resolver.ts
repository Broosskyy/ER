import type { Event } from '@/features/events/types/event';

export type DiscoverySurface =
  | 'home'
  | 'events'
  | 'search'
  | 'map'
  | 'saved'
  | 'similar_events';

export interface DiscoveryEligibility {
  homeEligible: boolean;
  eventsEligible: boolean;
  searchEligible: boolean;
  mapEligible: boolean;
  savedEligible: boolean;
  similarEventsEligible: boolean;
  reasonCodes: string[];
}

function isPublic(event: Event): boolean {
  return event.status === 'published';
}

export class DiscoveryEligibilityResolver {
  resolve(event: Event, now = new Date()): DiscoveryEligibility {
    const reasonCodes: string[] = [];
    const publicEvent = isPublic(event);
    const isPast = new Date(event.endDateTime ?? event.startDateTime) < now;
    const hasLocation = event.latitude !== undefined && event.longitude !== undefined;

    if (!publicEvent) reasonCodes.push('not_public');
    if (isPast) reasonCodes.push('past');
    if (!hasLocation) reasonCodes.push('location_missing');

    const searchEligible = publicEvent;
    const eventsEligible = publicEvent && !isPast;
    return {
      homeEligible: eventsEligible && Boolean(event.imageUrl),
      eventsEligible,
      searchEligible,
      mapEligible: eventsEligible && hasLocation,
      savedEligible: event.status !== 'draft' && event.status !== 'rejected',
      similarEventsEligible: eventsEligible,
      reasonCodes,
    };
  }
}

export const discoveryEligibilityResolver = new DiscoveryEligibilityResolver();
