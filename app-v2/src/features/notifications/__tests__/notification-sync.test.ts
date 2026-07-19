import { describe, expect, it } from 'vitest';

import type { Event } from '@/features/events/types/event';

import {
  createEventSnapshot,
  syncNotifications,
} from '../services/notification-sync';
import type { Notification } from '../types/notification';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'VOID: Techno Saturday',
    description: 'Demo',
    startDateTime: '2026-05-24T23:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Bootshaus',
    city: 'Köln',
    country: 'Germany',
    genres: ['Techno'],
    artists: ['VOID Collective'],
    source: 'demo',
    sourceEventId: 'event-1',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('notification sync', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');

  it('creates a baseline snapshot without notifications on first run', () => {
    const events = [createEvent()];

    const result = syncNotifications({
      events,
      favoriteIds: [],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    expect(result.notifications).toEqual([]);
    expect(result.snapshot.events['event-1']?.title).toBe('VOID: Techno Saturday');
  });

  it('creates a new-event notification after a baseline snapshot exists', () => {
    const baselineEvents = [createEvent()];
    const baseline = syncNotifications({
      events: baselineEvents,
      favoriteIds: [],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    const newEvent = createEvent({
      id: 'event-2',
      slug: 'event-2',
      title: 'Rhein Nights',
      sourceEventId: 'event-2',
      startDateTime: '2026-05-25T22:00:00.000Z',
    });

    const result = syncNotifications({
      events: [...baselineEvents, newEvent],
      favoriteIds: [],
      previousSnapshot: baseline.snapshot,
      existingNotifications: baseline.notifications,
      now,
    });

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.type).toBe('event_new');
    expect(result.notifications[0]?.eventId).toBe('event-2');
  });

  it('does not create duplicate notifications on repeated sync', () => {
    const baselineEvents = [createEvent()];
    const baseline = syncNotifications({
      events: baselineEvents,
      favoriteIds: [],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    const newEvent = createEvent({
      id: 'event-2',
      slug: 'event-2',
      title: 'Rhein Nights',
      sourceEventId: 'event-2',
    });

    const firstChange = syncNotifications({
      events: [...baselineEvents, newEvent],
      favoriteIds: [],
      previousSnapshot: baseline.snapshot,
      existingNotifications: baseline.notifications,
      now,
    });

    const secondChange = syncNotifications({
      events: [...baselineEvents, newEvent],
      favoriteIds: [],
      previousSnapshot: firstChange.snapshot,
      existingNotifications: firstChange.notifications,
      now,
    });

    expect(secondChange.notifications).toHaveLength(1);
  });

  it('creates saved-event update notifications for favorites', () => {
    const original = createEvent({ id: 'saved-1', sourceEventId: 'saved-1' });
    const baseline = syncNotifications({
      events: [original],
      favoriteIds: ['saved-1'],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    const updated = createEvent({
      id: 'saved-1',
      sourceEventId: 'saved-1',
      title: 'VOID: Updated Title',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = syncNotifications({
      events: [updated],
      favoriteIds: ['saved-1'],
      previousSnapshot: baseline.snapshot,
      existingNotifications: baseline.notifications,
      now,
    });

    expect(result.notifications.some((item) => item.type === 'event_updated')).toBe(true);
  });

  it('creates cancelled notifications when an event is cancelled', () => {
    const original = createEvent({ id: 'cancel-1', sourceEventId: 'cancel-1' });
    const baseline = syncNotifications({
      events: [original],
      favoriteIds: ['cancel-1'],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    const cancelled = createEvent({
      id: 'cancel-1',
      sourceEventId: 'cancel-1',
      status: 'cancelled',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = syncNotifications({
      events: [cancelled],
      favoriteIds: ['cancel-1'],
      previousSnapshot: baseline.snapshot,
      existingNotifications: baseline.notifications,
      now,
    });

    expect(result.notifications.some((item) => item.type === 'event_cancelled')).toBe(true);
  });

  it('creates ticket info notifications when ticket data appears', () => {
    const original = createEvent({ id: 'ticket-1', sourceEventId: 'ticket-1' });
    const baseline = syncNotifications({
      events: [original],
      favoriteIds: ['ticket-1'],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    const withTickets = createEvent({
      id: 'ticket-1',
      sourceEventId: 'ticket-1',
      ticketUrl: 'https://tickets.example.com/ticket-1',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = syncNotifications({
      events: [withTickets],
      favoriteIds: ['ticket-1'],
      previousSnapshot: baseline.snapshot,
      existingNotifications: baseline.notifications,
      now,
    });

    expect(result.notifications.some((item) => item.type === 'ticket_info')).toBe(true);
  });

  it('creates upcoming notifications for saved events in the window', () => {
    const upcoming = createEvent({
      id: 'upcoming-1',
      sourceEventId: 'upcoming-1',
      startDateTime: '2026-05-26T22:00:00.000Z',
    });

    const baseline = syncNotifications({
      events: [upcoming],
      favoriteIds: ['upcoming-1'],
      previousSnapshot: null,
      existingNotifications: [],
      now,
    });

    const result = syncNotifications({
      events: [upcoming],
      favoriteIds: ['upcoming-1'],
      previousSnapshot: baseline.snapshot,
      existingNotifications: baseline.notifications,
      now,
    });

    expect(result.notifications.some((item) => item.type === 'event_upcoming')).toBe(true);
  });

  it('preserves existing notifications across sync', () => {
    const existing: Notification[] = [
      {
        id: 'existing-1',
        type: 'event_new',
        title: 'Neues Event',
        message: 'Existing',
        eventId: 'event-1',
        createdAt: '2026-05-20T10:00:00.000Z',
        readAt: null,
        status: 'unread',
        dedupeKey: 'event_new:event-1',
      },
    ];

    const events = [createEvent()];
    const snapshot = createEventSnapshot(events, now.toISOString());

    const result = syncNotifications({
      events,
      favoriteIds: [],
      previousSnapshot: snapshot,
      existingNotifications: existing,
      now,
    });

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.id).toBe('existing-1');
  });
});
