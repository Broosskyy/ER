import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';

import type { EventId, FavoritesStore } from './types';

interface FavoritesContextValue extends FavoritesStore {
  favoriteEvents: EventDisplayModel[];
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function resolveFavoriteEvents(favoriteIds: ReadonlySet<EventId>): EventDisplayModel[] {
  return Array.from(favoriteIds)
    .map((eventId) => eventRepository.getEventById(eventId))
    .filter((event) => event !== undefined)
    .map(toEventDisplayModel);
}

export interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const [favoriteIds, setFavoriteIds] = useState<Set<EventId>>(() => new Set());

  const isFavorite = useCallback(
    (eventId: EventId) => favoriteIds.has(eventId),
    [favoriteIds],
  );

  const addFavorite = useCallback((eventId: EventId) => {
    if (!eventRepository.hasPublishedEvent(eventId)) {
      return;
    }

    setFavoriteIds((current) => {
      if (current.has(eventId)) {
        return current;
      }

      const next = new Set(current);
      next.add(eventId);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((eventId: EventId) => {
    setFavoriteIds((current) => {
      if (!current.has(eventId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(eventId);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((eventId: EventId) => {
    setFavoriteIds((current) => {
      if (!eventRepository.hasPublishedEvent(eventId)) {
        return current;
      }

      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const favoriteEvents = useMemo(() => resolveFavoriteEvents(favoriteIds), [favoriteIds]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteIds,
      favoriteEvents,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
    }),
    [favoriteIds, favoriteEvents, isFavorite, toggleFavorite, addFavorite, removeFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }

  return context;
}
