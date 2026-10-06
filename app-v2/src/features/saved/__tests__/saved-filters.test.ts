import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { SavedEvent } from '@/features/saved/types/saved-event';
import { countSavedEventsByFilter, filterSavedEvents } from '@/features/saved/utils/saved-filters';

const REFERENCE_DATE = '2026-05-24T12:00:00.000Z';

function createSavedEvent(overrides: Partial<EventDisplayModel> = {}): SavedEvent {
  return {
    eventId: overrides.id ?? 'sample',
    savedAt: REFERENCE_DATE,
    event: {
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
    },
  };
}

describe('saved filters', () => {
  const upcoming = createSavedEvent({ id: 'upcoming', startDateTime: '2026-05-25T23:00:00' });
  const past = createSavedEvent({ id: 'past', startDateTime: '2026-04-10T22:00:00' });
  const cancelled = createSavedEvent({ id: 'cancelled', status: 'archived', startDateTime: '2026-05-26T23:00:00' });
  const postponed = createSavedEvent({ id: 'klangkuenstler-berghain', startDateTime: '2026-05-27T23:00:00' });
  const events = [upcoming, past, cancelled, postponed];

  it('filters upcoming saved events', () => {
    const filtered = filterSavedEvents(events, 'upcoming');
    expect(filtered.map((item) => item.eventId)).toEqual(['upcoming', 'klangkuenstler-berghain']);
  });

  it('filters past saved events', () => {
    const filtered = filterSavedEvents(events, 'past');
    expect(filtered.map((item) => item.eventId)).toEqual(['past']);
  });

  it('filters cancelled saved events', () => {
    const filtered = filterSavedEvents(events, 'cancelled');
    expect(filtered.map((item) => item.eventId)).toEqual(['cancelled']);
  });

  it('counts events per filter tab', () => {
    expect(countSavedEventsByFilter(events)).toEqual({
      all: 4,
      upcoming: 2,
      past: 1,
      cancelled: 1,
    });
  });
});
