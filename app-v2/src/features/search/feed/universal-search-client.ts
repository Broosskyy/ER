import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface UniversalSearchResults {
  events: EventDisplayModel[];
  artists: Array<{ id: string; name: string }>;
  venues: Array<{ id: string; name: string; city?: string }>;
  organizers: Array<{ id: string; name: string }>;
}

export async function searchUniversal(_query: string): Promise<UniversalSearchResults> {
  return {
    events: [],
    artists: [],
    venues: [],
    organizers: [],
  };
}
