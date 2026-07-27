import type { SavedEvent } from '@/features/saved/types/saved-event';
import type { SavedFilterId } from '@/features/saved/types/saved-event';

import {
  isSavedEventCancelled,
  isSavedEventPast,
  isSavedEventUpcoming,
} from './saved-presentation';

export function filterSavedEvents(events: SavedEvent[], filter: SavedFilterId): SavedEvent[] {
  switch (filter) {
    case 'upcoming':
      return events.filter((item) => isSavedEventUpcoming(item.event) && !isSavedEventCancelled(item.event));
    case 'past':
      return events.filter((item) => isSavedEventPast(item.event));
    case 'cancelled':
      return events.filter((item) => isSavedEventCancelled(item.event));
    case 'all':
    default:
      return events;
  }
}

export function countSavedEventsByFilter(events: SavedEvent[]): Record<SavedFilterId, number> {
  return {
    all: events.length,
    upcoming: filterSavedEvents(events, 'upcoming').length,
    past: filterSavedEvents(events, 'past').length,
    cancelled: filterSavedEvents(events, 'cancelled').length,
  };
}
