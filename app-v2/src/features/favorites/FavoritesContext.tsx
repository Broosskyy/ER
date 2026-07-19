import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';

import {
  FAVORITES_STORAGE_KEY,
  loadFavoriteIdsFromStorage,
  saveFavoriteIdsToStorage,
} from './favorites-storage';
import type { EventId, FavoritesStore } from './types';

interface FavoritesContextValue extends FavoritesStore {
  favoriteEvents: EventDisplayModel[];
  isHydrated: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function resolveFavoriteEvents(favoriteIds: ReadonlySet<EventId>): EventDisplayModel[] {
  return Array.from(favoriteIds)
    .map((eventId) => eventRepository.getEventById(eventId))
    .filter((event) => event !== undefined)
    .map(toEventDisplayModel);
}

function sanitizeFavoriteIds(ids: readonly EventId[]): EventId[] {
  const seen = new Set<EventId>();

  return ids.filter((eventId) => {
    if (!eventId || seen.has(eventId) || !eventRepository.hasPublishedEvent(eventId)) {
      return false;
    }

    seen.add(eventId);
    return true;
  });
}

export interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const [favoriteIds, setFavoriteIds] = useState<Set<EventId>>(() => new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const skipNextPersistRef = useRef(true);

  useEffect(() => {
    let active = true;

    async function hydrateFavorites() {
      const storedIds = await loadFavoriteIdsFromStorage();
      const validIds = sanitizeFavoriteIds(storedIds);

      if (!active) {
        return;
      }

      setFavoriteIds(new Set(validIds));
      setIsHydrated(true);
    }

    void hydrateFavorites();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    void saveFavoriteIdsToStorage(Array.from(favoriteIds));
  }, [favoriteIds, isHydrated]);

  const isFavorite = useCallback(
    (eventId: EventId) => isHydrated && favoriteIds.has(eventId),
    [favoriteIds, isHydrated],
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
      isHydrated,
    }),
    [favoriteIds, favoriteEvents, isFavorite, toggleFavorite, addFavorite, removeFavorite, isHydrated],
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

export { FAVORITES_STORAGE_KEY };
