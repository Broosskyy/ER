import type { Event } from '@/features/events/types/event';
import {
  addDays,
  endOfDay,
  EVENT_REFERENCE_DATE,
  parseIsoDateTime,
  startOfDay,
} from '@/features/events/formatting/date-time';

import type { EventSnapshot, EventSnapshotEntry } from '../types/event-snapshot';
import type { Notification } from '../types/notification';

export const UPCOMING_NOTIFICATION_WINDOW_DAYS = 7;

export interface NotificationSyncInput {
  events: readonly Event[];
  favoriteIds: readonly string[];
  previousSnapshot: EventSnapshot | null;
  existingNotifications: readonly Notification[];
  referenceDate?: Date;
  now?: Date;
}

export interface NotificationSyncResult {
  notifications: Notification[];
  snapshot: EventSnapshot;
}

export function createEventSnapshotEntry(event: Event): EventSnapshotEntry {
  return {
    id: event.id,
    title: event.title,
    startDateTime: event.startDateTime,
    venue: event.venue,
    status: event.status,
    priceText: event.priceText,
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

function hasMeaningfulEventChange(
  previous: EventSnapshotEntry,
  current: EventSnapshotEntry,
): boolean {
  return (
    previous.title !== current.title ||
    previous.startDateTime !== current.startDateTime ||
    previous.venue !== current.venue ||
    previous.status !== current.status ||
    previous.priceText !== current.priceText ||
    previous.ticketUrl !== current.ticketUrl
  );
}

function hasTicketInfoChange(
  previous: EventSnapshotEntry | undefined,
  current: EventSnapshotEntry,
): boolean {
  const previousTicketUrl = previous?.ticketUrl ?? '';
  const previousPriceText = previous?.priceText ?? '';
  const currentTicketUrl = current.ticketUrl ?? '';
  const currentPriceText = current.priceText ?? '';

  const gainedTicketUrl = currentTicketUrl.length > 0 && currentTicketUrl !== previousTicketUrl;
  const gainedPriceText = currentPriceText.length > 0 && currentPriceText !== previousPriceText;

  return gainedTicketUrl || gainedPriceText;
}

function isUpcomingSavedEvent(
  event: Event,
  favoriteIds: ReadonlySet<string>,
  referenceDate: Date,
): boolean {
  if (!favoriteIds.has(event.id)) {
    return false;
  }

  const eventDate = parseIsoDateTime(event.startDateTime);

  if (!eventDate || event.status === 'cancelled') {
    return false;
  }

  const windowStart = startOfDay(referenceDate);
  const windowEnd = endOfDay(addDays(windowStart, UPCOMING_NOTIFICATION_WINDOW_DAYS));

  return eventDate >= windowStart && eventDate <= windowEnd;
}

function createNotificationId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildNotification(
  partial: Omit<Notification, 'id' | 'createdAt' | 'readAt' | 'status'>,
  now: Date,
): Notification {
  return {
    id: createNotificationId(),
    createdAt: now.toISOString(),
    readAt: null,
    status: 'unread',
    ...partial,
  };
}

export function syncNotifications(input: NotificationSyncInput): NotificationSyncResult {
  const {
    events,
    favoriteIds,
    previousSnapshot,
    existingNotifications,
    referenceDate = EVENT_REFERENCE_DATE,
    now = new Date(),
  } = input;

  const favoriteIdSet = new Set(favoriteIds);
  const existingDedupeKeys = new Set(existingNotifications.map((item) => item.dedupeKey));
  const nextNotifications = [...existingNotifications];
  const capturedAt = now.toISOString();
  const nextSnapshot = createEventSnapshot(events, capturedAt);

  if (!previousSnapshot) {
    return {
      notifications: nextNotifications,
      snapshot: nextSnapshot,
    };
  }

  const previousEvents = previousSnapshot.events;

  for (const event of events) {
    const currentEntry = createEventSnapshotEntry(event);
    const previousEntry = previousEvents[event.id];
    const isFavorite = favoriteIdSet.has(event.id);

    if (!previousEntry) {
      const dedupeKey = `event_new:${event.id}`;

      if (!existingDedupeKeys.has(dedupeKey)) {
        const notification = buildNotification(
          {
            type: 'event_new',
            title: 'Neues Event',
            message: `${event.title} wurde hinzugefügt.`,
            eventId: event.id,
            dedupeKey,
            imageUrl: event.imageUrl,
          },
          now,
        );

        nextNotifications.unshift(notification);
        existingDedupeKeys.add(dedupeKey);
      }

      continue;
    }

    if (event.status === 'cancelled' && previousEntry.status !== 'cancelled') {
      const dedupeKey = `event_cancelled:${event.id}`;

      if (!existingDedupeKeys.has(dedupeKey)) {
        const notification = buildNotification(
          {
            type: 'event_cancelled',
            title: 'Event abgesagt',
            message: `${event.title} wurde abgesagt.`,
            eventId: event.id,
            dedupeKey,
            imageUrl: event.imageUrl,
          },
          now,
        );

        nextNotifications.unshift(notification);
        existingDedupeKeys.add(dedupeKey);
      }
    }

    if (isFavorite && hasMeaningfulEventChange(previousEntry, currentEntry)) {
      const dedupeKey = `event_updated:${event.id}:${event.updatedAt}`;

      if (!existingDedupeKeys.has(dedupeKey) && event.status !== 'cancelled') {
        const notification = buildNotification(
          {
            type: 'event_updated',
            title: 'Event aktualisiert',
            message: `${event.title} wurde geändert.`,
            eventId: event.id,
            dedupeKey,
            imageUrl: event.imageUrl,
          },
          now,
        );

        nextNotifications.unshift(notification);
        existingDedupeKeys.add(dedupeKey);
      }
    }

    if (isFavorite && hasTicketInfoChange(previousEntry, currentEntry)) {
      const ticketMarker = currentEntry.ticketUrl ?? currentEntry.priceText ?? 'available';
      const dedupeKey = `ticket_info:${event.id}:${ticketMarker}`;

      if (!existingDedupeKeys.has(dedupeKey)) {
        const notification = buildNotification(
          {
            type: 'ticket_info',
            title: 'Ticket-Info',
            message: `Tickets für ${event.title} sind verfügbar.`,
            eventId: event.id,
            dedupeKey,
            imageUrl: event.imageUrl,
          },
          now,
        );

        nextNotifications.unshift(notification);
        existingDedupeKeys.add(dedupeKey);
      }
    }

    if (isUpcomingSavedEvent(event, favoriteIdSet, referenceDate)) {
      const dedupeKey = `event_upcoming:${event.id}`;

      if (!existingDedupeKeys.has(dedupeKey)) {
        const notification = buildNotification(
          {
            type: 'event_upcoming',
            title: 'Bald bei dir',
            message: `${event.title} findet bald statt.`,
            eventId: event.id,
            dedupeKey,
            imageUrl: event.imageUrl,
          },
          now,
        );

        nextNotifications.unshift(notification);
        existingDedupeKeys.add(dedupeKey);
      }
    }
  }

  return {
    notifications: nextNotifications,
    snapshot: nextSnapshot,
  };
}
