import type { SavedEventSource } from '@/features/saved/types/saved-event';

/** Stable demo event identifier used for session favorites. */
export type EventId = string;

export type FavoriteToggleHandler = (eventId: EventId, source?: SavedEventSource) => void;

/**
 * Session favorites store contract.
 * Designed for a future swap to async user-scoped persistence.
 */
export interface FavoritesStore {
  favoriteIds: ReadonlySet<EventId>;
  isFavorite: (eventId: EventId) => boolean;
  toggleFavorite: FavoriteToggleHandler;
  addFavorite: (eventId: EventId, source?: SavedEventSource) => void;
  removeFavorite: (eventId: EventId) => void;
}
