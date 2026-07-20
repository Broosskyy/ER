import { describe, expect, it } from 'vitest';

import type { Event } from '@/features/events/types/event';

import {
  createEventSnapshot,
  generateNotifications,
} from '../services/notification-generation';
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

const basePreferences = {
  favoriteIds: ['saved-1'],
  preferredCity: 'Köln',
  preferredGenres: ['Techno'],
};

describe('notification generation', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');

  it('creates a baseline snapshot without notifications', () => {
    const result = generateNotifications({
      events: [createEvent()],
      preferences: basePreferences,
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    expect(result.isBaseline).toBe(true);
    expect(result.created).toEqual([]);
  });

  it('detects venue changes for saved events', () => {
    const original = createEvent({ id: 'saved-1', sourceEventId: 'saved-1' });
    const baseline = generateNotifications({
      events: [original],
      preferences: basePreferences,
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const updated = createEvent({
      id: 'saved-1',
      sourceEventId: 'saved-1',
      venue: 'Artheater',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = generateNotifications({
      events: [updated],
      preferences: basePreferences,
      previousSnapshot: baseline.snapshot,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    expect(result.created.some((item) => item.type === 'saved_event_updated')).toBe(true);
  });

  it('detects date and time changes for saved events', () => {
    const original = createEvent({ id: 'saved-1', sourceEventId: 'saved-1' });
    const baseline = generateNotifications({
      events: [original],
      preferences: basePreferences,
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const updated = createEvent({
      id: 'saved-1',
      sourceEventId: 'saved-1',
      startDateTime: '2026-05-25T23:00:00.000Z',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = generateNotifications({
      events: [updated],
      preferences: basePreferences,
      previousSnapshot: baseline.snapshot,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    expect(result.created.some((item) => item.type === 'saved_event_updated')).toBe(true);
  });

  it('detects cancelled saved events', () => {
    const original = createEvent({ id: 'saved-1', sourceEventId: 'saved-1' });
    const baseline = generateNotifications({
      events: [original],
      preferences: basePreferences,
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const cancelled = createEvent({
      id: 'saved-1',
      sourceEventId: 'saved-1',
      status: 'archived',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = generateNotifications({
      events: [cancelled],
      preferences: basePreferences,
      previousSnapshot: baseline.snapshot,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    expect(result.created.some((item) => item.type === 'saved_event_cancelled')).toBe(true);
  });

  it('detects ticket availability for saved events', () => {
    const original = createEvent({ id: 'saved-1', sourceEventId: 'saved-1' });
    const baseline = generateNotifications({
      events: [original],
      preferences: basePreferences,
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const withTicket = createEvent({
      id: 'saved-1',
      sourceEventId: 'saved-1',
      ticketUrl: 'https://tickets.example.com/saved-1',
      updatedAt: '2026-05-24T13:00:00.000Z',
    });

    const result = generateNotifications({
      events: [withTicket],
      preferences: basePreferences,
      previousSnapshot: baseline.snapshot,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    expect(result.created.some((item) => item.type === 'ticket_available')).toBe(true);
  });

  it('creates starting soon notifications only once', () => {
    const upcoming = createEvent({
      id: 'saved-1',
      sourceEventId: 'saved-1',
      startDateTime: '2026-05-25T10:00:00.000Z',
    });

    const baseline = generateNotifications({
      events: [upcoming],
      preferences: basePreferences,
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const first = generateNotifications({
      events: [upcoming],
      preferences: basePreferences,
      previousSnapshot: baseline.snapshot,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const dedupeKeys = new Set(first.created.map((item) => item.deduplicationKey));

    const second = generateNotifications({
      events: [upcoming],
      preferences: basePreferences,
      previousSnapshot: first.snapshot,
      existingNotifications: first.created,
      knownDeduplicationKeys: dedupeKeys,
      now,
    });

    expect(first.created.some((item) => item.type === 'saved_event_starting_soon')).toBe(true);
    expect(second.created).toEqual([]);
  });

  it('does not create duplicate notifications on repeated sync', () => {
    const events = [createEvent({ id: 'event-2', sourceEventId: 'event-2', title: 'Rhein Nights' })];
    const baseline = generateNotifications({
      events: [createEvent()],
      preferences: { ...basePreferences, favoriteIds: ['event-1'] },
      previousSnapshot: null,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const withNewEvent = [...events, createEvent()];
    const first = generateNotifications({
      events: withNewEvent,
      preferences: { ...basePreferences, favoriteIds: ['event-1'] },
      previousSnapshot: baseline.snapshot,
      existingNotifications: [],
      knownDeduplicationKeys: new Set(),
      now,
    });

    const known = new Set(first.created.map((item) => item.deduplicationKey));
    const second = generateNotifications({
      events: withNewEvent,
      preferences: { ...basePreferences, favoriteIds: ['event-1'] },
      previousSnapshot: first.snapshot,
      existingNotifications: first.created as Notification[],
      knownDeduplicationKeys: known,
      now,
    });

    expect(second.created).toEqual([]);
  });
});
