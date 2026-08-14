import type { SavedEvent } from '@/features/saved/types/saved-event';

export type SavedFilterId = 'all' | 'upcoming' | 'past' | 'cancelled';

export function filterSavedEvents(events: SavedEvent[], filter: SavedFilterId): SavedEvent[] {
  if (filter === 'all') {
    return events;
  }
  return [];
}

export function countSavedEventsByFilter(events: SavedEvent[]): Record<SavedFilterId, number> {
  return {
    all: events.length,
    upcoming: 0,
    past: 0,
    cancelled: 0,
  };
}
