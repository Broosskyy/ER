import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  isTicketActionDisabled,
  resolveEventNoticeType,
  resolveEventPresentation,
} from '@/features/events/status/event-status-resolver';

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
    sourceLabel: 'Eternal Rave Demo',
    startsAt: '2026-05-24T23:00:00',
    startDateTime: '2026-05-24T23:00:00',
    timezone: 'Europe/Berlin',
    status: 'published',
    ...overrides,
  };
}

describe('event status resolver', () => {
  it('prioritises cancelled over ticket availability', () => {
    const event = createEvent({ status: 'archived', priceText: 'ab 20 €', ticketUrl: 'https://example.com' });
    const presentation = resolveEventPresentation(event);

    expect(presentation.primaryStatus).toBe('cancelled');
    expect(presentation.ticketStatus).toBeUndefined();
    expect(isTicketActionDisabled(event)).toBe(true);
  });

  it('resolves postponed demo override', () => {
    const event = createEvent({ id: 'klangkuenstler-berghain' });
    expect(resolveEventNoticeType(event)).toBe('postponed');
  });

  it('resolves sold out from price text', () => {
    const event = createEvent({ priceText: 'Ausverkauft' });
    const presentation = resolveEventPresentation(event);

    expect(presentation.primaryStatus).toBe('sold_out');
    expect(presentation.ticketStatus).toBe('sold_out');
  });

  it('resolves today status for events on the reference day', () => {
    const event = createEvent({ startDateTime: '2026-05-24T23:00:00' });
    expect(resolveEventPresentation(event).consumerStatuses).toContain('today');
  });

  it('limits card status to the highest-priority consumer status', () => {
    const event = createEvent({
      id: 'void-techno-saturday',
      startDateTime: '2026-05-24T23:00:00',
      priceText: 'Kostenlos',
    });
    const presentation = resolveEventPresentation(event);

    expect(presentation.consumerStatuses[0]).toBe('free');
  });
});
