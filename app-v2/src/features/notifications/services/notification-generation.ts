import type { Event } from '@/features/events/types/event';
import {
  addDays,
  parseIsoDateTime,
} from '@/features/events/formatting/date-time';

import type { EventSnapshot, EventSnapshotEntry } from '../types/event-snapshot';
import type { Notification } from '../types/notification';
import { buildDeduplicationKey } from './notification-deduplication';

export const STARTING_SOON_WINDOW_HOURS = 24;

export interface NotificationGenerationPreferences {
  favoriteIds: readonly string[];
  preferredCity: string;
  preferredGenres: readonly string[];
}

export interface NotificationGenerationInput {
  events: readonly Event[];
  preferences: NotificationGenerationPreferences;
  previousSnapshot: EventSnapshot | null;
  existingNotifications: readonly Notification[];
  knownDeduplicationKeys: ReadonlySet<string>;
  referenceDate?: Date;
  now?: Date;
}

export interface NotificationGenerationResult {
  created: Notification[];
  snapshot: EventSnapshot;
  isBaseline: boolean;
}

function createNotificationId(now: Date): string {
  return `notification-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createNotification(
  partial: Omit<Notification, 'id' | 'createdAt' | 'readAt' | 'deletedAt'>,
  now: Date,
): Notification {
  return {
    id: createNotificationId(now),
    createdAt: now.toISOString(),
    readAt: null,
    deletedAt: null,
    ...partial,
  };
}

export function createEventSnapshotEntry(event: Event): EventSnapshotEntry {
  return {
    id: event.id,
    title: event.title,
    startDateTime: event.startDateTime,
    venue: event.venue,
    status: event.status,
    ticketUrl: event.ticketUrl,
    updatedAt: event.updatedAt,
  };
}

export function createEventSnapshot(
  events: readonly Event[],
  capturedAt: string,
): EventSnapshot {
  const entries: Record<string, EventSnapshotEntry> = {};

  for (const event of events) {
    entries[event.id] = createEventSnapshotEntry(event);
  }

  return {
    version: 1,
    capturedAt,
    events: entries,
  };
}

function hasFieldChange(previous: EventSnapshotEntry, current: EventSnapshotEntry, field: keyof EventSnapshotEntry): boolean {
  return previous[field] !== current[field];
}

function isStartingSoonEvent(
  event: Event,
  referenceDate: Date,
): boolean {
  const eventDate = parseIsoDateTime(event.startDateTime);

  if (!eventDate || event.status === 'cancelled') {
    return false;
  }

  const windowStart = referenceDate;
  const windowEnd = addDays(referenceDate, 0);
  windowEnd.setTime(referenceDate.getTime() + STARTING_SOON_WINDOW_HOURS * 60 * 60 * 1000);

  return eventDate >= windowStart && eventDate <= windowEnd;
}

function matchesNewEventPreferences(
  event: Event,
  preferences: NotificationGenerationPreferences,
): boolean {
  if (preferences.favoriteIds.length === 0 && preferences.preferredGenres.length === 0) {
    return false;
  }

  const cityMatches =
    event.city.toLowerCase() === preferences.preferredCity.toLowerCase();

  const genreMatches =
    preferences.preferredGenres.length > 0 &&
    event.genres.some((genre) =>
      preferences.preferredGenres.some(
        (preferred) => preferred.toLowerCase() === genre.toLowerCase(),
      ),
    );

  return cityMatches || genreMatches;
}

function detectSavedEventChanges(
  event: Event,
  previous: EventSnapshotEntry,
  current: EventSnapshotEntry,
  now: Date,
  knownKeys: ReadonlySet<string>,
): Notification[] {
  const created: Notification[] = [];
  const imageUrl = event.imageUrl;

  if (event.status === 'cancelled' && previous.status !== 'cancelled') {
    const deduplicationKey = buildDeduplicationKey({
      eventId: event.id,
      type: 'saved_event_cancelled',
    });

    if (!knownKeys.has(deduplicationKey)) {
      created.push(
        createNotification(
          {
            type: 'saved_event_cancelled',
            title: 'Event abgesagt',
            message: `${event.title} wurde abgesagt.`,
            eventId: event.id,
            deduplicationKey,
            metadata: { imageUrl },
          },
          now,
        ),
      );
    }

    return created;
  }

  const changes: Array<{ field: string; previousValue: string; currentValue: string }> = [];

  if (hasFieldChange(previous, current, 'startDateTime')) {
    changes.push({
      field: 'startDateTime',
      previousValue: previous.startDateTime,
      currentValue: current.startDateTime,
    });
  }

  if (hasFieldChange(previous, current, 'venue')) {
    changes.push({
      field: 'venue',
      previousValue: previous.venue,
      currentValue: current.venue,
    });
  }

  if (hasFieldChange(previous, current, 'status') && event.status !== 'cancelled') {
    changes.push({
      field: 'status',
      previousValue: previous.status,
      currentValue: current.status,
    });
  }

  if (changes.length > 0) {
    const deduplicationKey = buildDeduplicationKey({
      eventId: event.id,
      type: 'saved_event_updated',
      version: event.updatedAt,
    });

    if (!knownKeys.has(deduplicationKey)) {
      created.push(
        createNotification(
          {
            type: 'saved_event_updated',
            title: 'Gespeichertes Event aktualisiert',
            message: `${event.title} wurde geändert.`,
            eventId: event.id,
            deduplicationKey,
            metadata: {
              imageUrl,
              changeVersion: event.updatedAt,
              field: changes.map((change) => change.field).join(','),
              previousValue: changes.map((change) => change.previousValue).join('|'),
              currentValue: changes.map((change) => change.currentValue).join('|'),
            },
          },
          now,
        ),
      );
    }
  }

  const previousTicketUrl = previous.ticketUrl ?? '';
  const currentTicketUrl = current.ticketUrl ?? '';

  if (currentTicketUrl.length > 0 && currentTicketUrl !== previousTicketUrl) {
    const deduplicationKey = buildDeduplicationKey({
      eventId: event.id,
      type: 'ticket_available',
      version: currentTicketUrl,
    });

    if (!knownKeys.has(deduplicationKey)) {
      created.push(
        createNotification(
          {
            type: 'ticket_available',
            title: 'Tickets verfügbar',
            message: `Tickets für ${event.title} sind jetzt verfügbar.`,
            eventId: event.id,
            deduplicationKey,
            metadata: { imageUrl },
          },
          now,
        ),
      );
    }
  }

  return created;
}

export function generateNotifications(
  input: NotificationGenerationInput,
): NotificationGenerationResult {
  const {
    events,
    preferences,
    previousSnapshot,
    knownDeduplicationKeys,
    now = new Date(),
  } = input;

  const capturedAt = now.toISOString();
  const nextSnapshot = createEventSnapshot(events, capturedAt);
  const favoriteIdSet = new Set(preferences.favoriteIds);
  const created: Notification[] = [];

  if (!previousSnapshot) {
    return {
      created,
      snapshot: nextSnapshot,
      isBaseline: true,
    };
  }

  const previousEvents = previousSnapshot.events;

  for (const event of events) {
    const currentEntry = createEventSnapshotEntry(event);
    const previousEntry = previousEvents[event.id];
    const isFavorite = favoriteIdSet.has(event.id);

    if (!previousEntry) {
      if (matchesNewEventPreferences(event, preferences)) {
        const deduplicationKey = buildDeduplicationKey({
          eventId: event.id,
          type: 'new_event',
        });

        if (!knownDeduplicationKeys.has(deduplicationKey)) {
          created.push(
            createNotification(
              {
                type: 'new_event',
                title: 'Neues Event',
                message: `${event.title} wurde hinzugefügt.`,
                eventId: event.id,
                deduplicationKey,
                metadata: { imageUrl: event.imageUrl },
              },
              now,
            ),
          );
        }
      }

      continue;
    }

    if (isFavorite) {
      created.push(
        ...detectSavedEventChanges(
          event,
          previousEntry,
          currentEntry,
          now,
          knownDeduplicationKeys,
        ),
      );

      if (isStartingSoonEvent(event, now)) {
        const deduplicationKey = buildDeduplicationKey({
          eventId: event.id,
          type: 'saved_event_starting_soon',
        });

        if (!knownDeduplicationKeys.has(deduplicationKey)) {
          created.push(
            createNotification(
              {
                type: 'saved_event_starting_soon',
                title: 'Bald bei dir',
                message: `${event.title} findet in den nächsten 24 Stunden statt.`,
                eventId: event.id,
                deduplicationKey,
                metadata: { imageUrl: event.imageUrl },
              },
              now,
            ),
          );
        }
      }
    }
  }

  return {
    created,
    snapshot: nextSnapshot,
    isBaseline: false,
  };
}

export function derivePreferredGenres(
  events: readonly Event[],
  favoriteIds: readonly string[],
): string[] {
  const favoriteSet = new Set(favoriteIds);
  const genres = new Set<string>();

  for (const event of events) {
    if (!favoriteSet.has(event.id)) {
      continue;
    }

    for (const genre of event.genres) {
      genres.add(genre);
    }
  }

  return Array.from(genres);
}
