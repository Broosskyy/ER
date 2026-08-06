import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { toEventCardViewModel, toEventListItemViewModel } from '@/features/events/formatting/event-card-view-model';

const sampleEvent: EventDisplayModel = {
  id: 'void-techno-saturday',
  slug: 'void-techno-saturday',
  title: 'VOID: Techno Saturday',
  description: 'Hard techno night',
  image: { uri: 'https://example.com/poster.png' },
  date: '09 MAI',
  startTime: '23:00',
  venue: 'Bootshaus',
  city: 'Köln',
  genres: ['Techno', 'Hard Techno'],
  artists: ['DJ VOID'],
  source: 'demo',
  sourceLabel: 'Demo source',
  startsAt: '2026-05-09T21:00:00.000Z',
  startDateTime: '2026-05-09T21:00:00.000Z',
  timezone: 'Europe/Berlin',
  status: 'published',
  priceText: 'Ab 15,00 €',
  organizer: 'VOID Events',
};

describe('toEventCardViewModel', () => {
  it('maps display events into discovery card view models', () => {
    const viewModel = toEventCardViewModel(sampleEvent);

    expect(viewModel).toMatchObject({
      id: 'void-techno-saturday',
      title: 'VOID: Techno Saturday',
      dateLabel: '09 MAI',
      weekdayLabel: 'SA',
      timeLabel: '23:00',
      venueLabel: 'Bootshaus',
      cityLabel: 'Köln',
      genreLabels: ['Techno', 'Hard Techno'],
      categoryLabel: 'Techno',
      organizerLabel: 'VOID Events',
      ticketLabel: 'ab 15,00 €',
      ticketStatus: 'available',
      accessibilityLabel: 'VOID: Techno Saturday, Bootshaus, Köln',
    });
    expect(viewModel.status).toBeUndefined();
  });

  it('detects sold-out ticket status from price text', () => {
    const viewModel = toEventCardViewModel({
      ...sampleEvent,
      priceText: 'Sold out',
    });

    expect(viewModel.ticketStatus).toBe('sold_out');
  });

  it('maps list item view models for compact rows', () => {
    const viewModel = toEventListItemViewModel(sampleEvent);

    expect(viewModel).toMatchObject({
      id: 'void-techno-saturday',
      title: 'VOID: Techno Saturday',
      venueLabel: 'Bootshaus',
      cityLabel: 'Köln',
    });
  });
});
