/** Stable demo event identifier used for session favorites. */
export type EventId = string;

/**
 * Session favorites store contract.
 * Designed for a future swap to async user-scoped persistence.
 */
export interface FavoritesStore {
  favoriteIds: ReadonlySet<EventId>;
  isFavorite: (eventId: EventId) => boolean;
  toggleFavorite: (eventId: EventId) => void;
  addFavorite: (eventId: EventId) => void;
  removeFavorite: (eventId: EventId) => void;
}
