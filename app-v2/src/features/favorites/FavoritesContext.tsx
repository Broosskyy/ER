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
import type { Event } from '@/features/events/types/event';
import type { SavedEvent, SavedEventRecord, SavedEventSource } from '@/features/saved/types/saved-event';

import {
  createSavedEventRecord,
  hasSavedEventsMigrationFlag,
  loadSavedEventRecords,
  markSavedEventsMigrationComplete,
  saveSavedEventRecords,
} from './saved-event-storage';
import { FAVORITES_STORAGE_KEY, loadFavoriteIdsFromStorage } from './favorites-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventId, FavoritesStore } from './types';

interface FavoritesContextValue extends FavoritesStore {
  favoriteEvents: EventDisplayModel[];
  savedEvents: SavedEvent[];
  isHydrated: boolean;
  getSavedAt: (eventId: EventId) => string | undefined;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function toCanonicalEventId(eventId: EventId): EventId {
  return eventRepository.resolveCanonicalId(eventId);
}

function sanitizeSavedRecords(records: readonly SavedEventRecord[]): SavedEventRecord[] {
  const seen = new Set<EventId>();

  return records
    .map((record) => ({
      ...record,
      eventId: toCanonicalEventId(record.eventId),
    }))
    .filter((record) => {
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

function buildUnavailableEventDisplayModel(eventId: string, savedAt: string): EventDisplayModel {
  const unavailableEvent: Event = {
    id: eventId,
    slug: eventId,
    title: 'Event nicht mehr verfügbar',
    description: '',
    startDateTime: savedAt,
    timezone: 'Europe/Berlin',
    venue: 'Unbekannt',
    city: '—',
    country: 'DE',
    genres: [],
    artists: [],
    source: 'demo',
    sourceEventId: eventId,
    status: 'archived',
    createdAt: savedAt,
    updatedAt: savedAt,
  };

  return toEventDisplayModel(unavailableEvent);
}

function resolveSavedEvents(records: readonly SavedEventRecord[]): SavedEvent[] {
  return records.map((record) => {
    const event = eventRepository.getEventById(record.eventId);

    if (!event) {
      return {
        ...record,
        unavailable: true,
        event: buildUnavailableEventDisplayModel(record.eventId, record.savedAt),
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
      const migrated = await hasSavedEventsMigrationFlag();

      if (records.length === 0 && !migrated) {
        const legacyIds = await loadFavoriteIdsFromStorage();
        if (legacyIds.length > 0) {
          records = legacyIds.map((eventId) => createSavedEventRecord(eventId, 'unknown'));
          await saveSavedEventRecords(records);
          await AsyncStorage.removeItem(FAVORITES_STORAGE_KEY);
          await markSavedEventsMigrationComplete();
        }
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
    (eventId: EventId) => isHydrated && favoriteIds.has(toCanonicalEventId(eventId)),
    [favoriteIds, isHydrated],
  );

  const getSavedAt = useCallback(
    (eventId: EventId) => savedRecords.find((record) => record.eventId === toCanonicalEventId(eventId))?.savedAt,
    [savedRecords],
  );

  const addFavorite = useCallback((eventId: EventId, source: SavedEventSource = 'unknown') => {
    const canonicalId = toCanonicalEventId(eventId);
    if (!eventRepository.hasPublishedEvent(canonicalId)) {
      return;
    }

    setSavedRecords((current) => {
      if (current.some((record) => record.eventId === canonicalId)) {
        return current;
      }

      return [...current, createSavedEventRecord(canonicalId, source)];
    });
  }, []);

  const removeFavorite = useCallback((eventId: EventId) => {
    const canonicalId = toCanonicalEventId(eventId);
    setSavedRecords((current) => current.filter((record) => record.eventId !== canonicalId));
  }, []);

  const toggleFavorite = useCallback((eventId: EventId, source: SavedEventSource = 'unknown') => {
    const canonicalId = toCanonicalEventId(eventId);

    setSavedRecords((current) => {
      const exists = current.some((record) => record.eventId === canonicalId);
      if (exists) {
        return current.filter((record) => record.eventId !== canonicalId);
      }

      if (!eventRepository.hasPublishedEvent(canonicalId)) {
        return current;
      }

      return [...current, createSavedEventRecord(canonicalId, source)];
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
