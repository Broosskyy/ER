import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface EventDetailEntities {
  venue: null;
  organizer: null;
  artists: [];
}

export function useEventDetailEntities(_event: EventDisplayModel | undefined): {
  entities: EventDetailEntities;
} {
  return {
    entities: {
      venue: null,
      organizer: null,
      artists: [],
    },
  };
}
