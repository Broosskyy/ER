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
import type { SavedEvent, SavedEventRecord, SavedEventSource } from '@/features/saved/types/saved-event';

import {
  createSavedEventRecord,
  loadSavedEventRecords,
  saveSavedEventRecords,
} from './saved-event-storage';
import { loadFavoriteIdsFromStorage } from './favorites-storage';
import type { EventId, FavoritesStore } from './types';

interface FavoritesContextValue extends FavoritesStore {
  favoriteEvents: EventDisplayModel[];
  savedEvents: SavedEvent[];
  isHydrated: boolean;
  getSavedAt: (eventId: EventId) => string | undefined;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function sanitizeSavedRecords(records: readonly SavedEventRecord[]): SavedEventRecord[] {
  const seen = new Set<EventId>();

  return records.filter((record) => {
    if (!record.eventId || seen.has(record.eventId)) {
      return false;
    }

    seen.add(record.eventId);
    return true;
  });
}

function resolveFavoriteEvents(records: readonly SavedEventRecord[]): EventDisplayModel[] {
  return records
    .map((record) => eventRepository.getEventById(record.eventId))
    .filter((event) => event !== undefined)
    .map(toEventDisplayModel);
}

function resolveSavedEvents(records: readonly SavedEventRecord[]): SavedEvent[] {
  return records.map((record) => {
    const event = eventRepository.getEventById(record.eventId);

    if (!event) {
      return {
        ...record,
        unavailable: true,
        event: {
          id: record.eventId,
          slug: record.eventId,
          title: 'Event nicht mehr verfügbar',
          description: '',
          image: 0,
          date: '—',
          startTime: '—',
          venue: 'Unbekannt',
          city: '—',
          genres: [],
          artists: [],
          source: 'demo',
          sourceLabel: 'Demo',
          startsAt: record.savedAt,
          startDateTime: record.savedAt,
          timezone: 'Europe/Berlin',
          status: 'archived',
        },
      };
    }

    return {
      ...record,
      event: toEventDisplayModel(event),
    };
  });
}

export interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const [savedRecords, setSavedRecords] = useState<SavedEventRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const skipNextPersistRef = useRef(true);

  useEffect(() => {
    let active = true;

    async function hydrateFavorites() {
      let records = await loadSavedEventRecords();

      if (records.length === 0) {
        const legacyIds = await loadFavoriteIdsFromStorage();
        records = legacyIds.map((eventId) => createSavedEventRecord(eventId, 'unknown'));
      }

      const validRecords = sanitizeSavedRecords(records);

      if (!active) {
        return;
      }

      setSavedRecords(validRecords);
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

    void saveSavedEventRecords(savedRecords);
  }, [savedRecords, isHydrated]);

  const favoriteIds = useMemo(() => new Set(savedRecords.map((record) => record.eventId)), [savedRecords]);

  const isFavorite = useCallback(
    (eventId: EventId) => isHydrated && favoriteIds.has(eventId),
    [favoriteIds, isHydrated],
  );

  const getSavedAt = useCallback(
    (eventId: EventId) => savedRecords.find((record) => record.eventId === eventId)?.savedAt,
    [savedRecords],
  );

  const addFavorite = useCallback((eventId: EventId, source: SavedEventSource = 'unknown') => {
    if (!eventRepository.hasPublishedEvent(eventId)) {
      return;
    }

    setSavedRecords((current) => {
      if (current.some((record) => record.eventId === eventId)) {
        return current;
      }

      return [...current, createSavedEventRecord(eventId, source)];
    });
  }, []);

  const removeFavorite = useCallback((eventId: EventId) => {
    setSavedRecords((current) => current.filter((record) => record.eventId !== eventId));
  }, []);

  const toggleFavorite = useCallback((eventId: EventId, source: SavedEventSource = 'unknown') => {
    if (!eventRepository.hasPublishedEvent(eventId)) {
      return;
    }

    setSavedRecords((current) => {
      const exists = current.some((record) => record.eventId === eventId);
      if (exists) {
        return current.filter((record) => record.eventId !== eventId);
      }

      return [...current, createSavedEventRecord(eventId, source)];
    });
  }, []);

  const favoriteEvents = useMemo(() => resolveFavoriteEvents(savedRecords), [savedRecords]);
  const savedEvents = useMemo(() => resolveSavedEvents(savedRecords), [savedRecords]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteIds,
      favoriteEvents,
      savedEvents,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      isHydrated,
      getSavedAt,
    }),
    [
      favoriteIds,
      favoriteEvents,
      savedEvents,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      isHydrated,
      getSavedAt,
    ],
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

export { FAVORITES_STORAGE_KEY } from './favorites-storage';
