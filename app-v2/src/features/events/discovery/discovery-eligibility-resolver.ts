import type { Event } from '@/features/events/types/event';
import type { DiscoverySurface as EngineSurface } from '@/features/discovery/domain/discovery-query-types';

import { isInternalPublicEvent } from './internal-event-eligibility';

export type DiscoverySurface =
  | 'home'
  | 'events'
  | 'search'
  | 'map'
  | 'saved'
  | 'similar_events'
  | 'profile_events';

export interface DiscoveryEligibility {
  homeEligible: boolean;
  eventsEligible: boolean;
  searchEligible: boolean;
  mapEligible: boolean;
  savedEligible: boolean;
  similarEventsEligible: boolean;
  profileEventsEligible: boolean;
  reasonCodes: string[];
}

function isPublic(event: Event): boolean {
  return event.status === 'published';
}

export function mapEngineSurfaceToEligibilityFlag(
  surface: EngineSurface | DiscoverySurface,
): keyof Omit<DiscoveryEligibility, 'reasonCodes'> {
  switch (surface) {
    case 'home':
    case 'home_featured':
    case 'home_today':
    case 'home_nearby':
      return 'homeEligible';
    case 'search':
    case 'search_events':
      return 'searchEligible';
    case 'map':
      return 'mapEligible';
    case 'saved':
      return 'savedEligible';
    case 'similar_events':
      return 'similarEventsEligible';
    case 'profile_events':
    case 'organizer_events':
    case 'venue_events':
    case 'festival_events':
      return 'profileEventsEligible';
    case 'events':
    case 'events_explore':
    case 'events_list':
    default:
      return 'eventsEligible';
  }
}

export class DiscoveryEligibilityResolver {
  resolve(event: Event, now = new Date()): DiscoveryEligibility {
    const reasonCodes: string[] = [];
    const publicEvent = isPublic(event);
    const isPast = new Date(event.endDateTime ?? event.startDateTime) < now;
    const hasLocation = event.latitude !== undefined && event.longitude !== undefined;
    const isInternal = isInternalPublicEvent(event);

    if (!publicEvent) reasonCodes.push('not_public');
    if (isPast) reasonCodes.push('past');
    if (!hasLocation) reasonCodes.push('location_missing');
    if (isInternal) reasonCodes.push('internal_test_data');

    const publiclyDiscoverable = publicEvent && !isInternal;
    const searchEligible = publiclyDiscoverable;
    const eventsEligible = publiclyDiscoverable && !isPast;

    return {
      homeEligible: eventsEligible && Boolean(event.imageUrl),
      eventsEligible,
      searchEligible,
      mapEligible: eventsEligible && hasLocation,
      // Saved keeps unavailable placeholders; do not hard-exclude internal records here.
      savedEligible: event.status !== 'draft' && event.status !== 'rejected',
      similarEventsEligible: eventsEligible,
      profileEventsEligible: eventsEligible,
      reasonCodes,
    };
  }

  isEligibleForSurface(
    event: Event,
    surface: EngineSurface | DiscoverySurface,
    now = new Date(),
  ): boolean {
    const eligibility = this.resolve(event, now);
    const flag = mapEngineSurfaceToEligibilityFlag(surface);
    return eligibility[flag];
  }
}

export const discoveryEligibilityResolver = new DiscoveryEligibilityResolver();
