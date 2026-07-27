import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  formatSavedAtLabel,
  isSavedEventCancelled,
  isSavedEventPast,
  isSavedEventUpcoming,
  resolveSavedConsumerStatus,
  resolveSavedTicketStatus,
} from '@/features/saved/utils/saved-presentation';

function createEvent(overrides: Partial<EventDisplayModel> = {}): EventDisplayModel {
  return {
    id: 'sample',
    slug: 'sample',
    title: 'Sample Event',
    description: '',
    image: 0,
    date: '24 MAI',
    startTime: '23:00',
    venue: 'Bootshaus',
    city: 'Köln',
    genres: ['Techno'],
    artists: [],
    source: 'demo',
    sourceLabel: 'Demo',
    startsAt: '2026-05-24T23:00:00',
    startDateTime: '2026-05-24T23:00:00',
    timezone: 'Europe/Berlin',
    status: 'published',
    ...overrides,
  };
}

describe('saved presentation', () => {
  it('resolves postponed demo status override', () => {
    const event = createEvent({ id: 'klangkuenstler-berghain' });
    expect(resolveSavedConsumerStatus(event)).toBe('postponed');
  });

  it('maps archived events to cancelled status', () => {
    const event = createEvent({ status: 'archived' });
    expect(resolveSavedConsumerStatus(event)).toBe('cancelled');
    expect(isSavedEventCancelled(event)).toBe(true);
  });

  it('detects sold out events from price text', () => {
    const event = createEvent({ priceText: 'Ausverkauft' });
    expect(resolveSavedConsumerStatus(event)).toBe('sold_out');
    expect(resolveSavedTicketStatus(event)).toBe('sold_out');
  });

  it('classifies upcoming and past events against the reference date', () => {
    const upcoming = createEvent({ startDateTime: '2026-05-25T23:00:00' });
    const past = createEvent({ startDateTime: '2026-04-10T22:00:00' });

    expect(isSavedEventUpcoming(upcoming)).toBe(true);
    expect(isSavedEventPast(past)).toBe(true);
  });

  it('formats saved-at labels in German', () => {
    expect(formatSavedAtLabel('2026-05-24T12:00:00')).toBe('Heute gespeichert');
    expect(formatSavedAtLabel('2026-05-23T12:00:00')).toBe('Gestern gespeichert');
    expect(formatSavedAtLabel('2026-05-20T12:00:00')).toBe('Vor 4 Tagen gespeichert');
  });
});
