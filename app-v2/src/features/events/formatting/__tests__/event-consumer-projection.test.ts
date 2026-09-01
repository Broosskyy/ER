import { describe, expect, it } from 'vitest';

import { toEventCardViewModel, toEventListItemViewModel } from '@/features/events/formatting/event-card-view-model';
import { toEventDisplayModelFromDetail } from '@/data/mappers/event-core-display';
import { mapEventDetail } from '@/data/mappers/event-core-mapper';
import { resolvePublicTicketPresentation } from '@/features/events/status/event-status-resolver';

const venueRow = {
  id: 'venue-1',
  name: 'Bootshaus',
  address_line: 'Auenweg 173',
  postal_code: '51063',
  city: 'Köln',
  country_code: 'DE',
  latitude: null,
  longitude: null,
  official_url: null,
  created_at: '2026-08-14T08:00:00Z',
  updated_at: '2026-08-14T08:00:00Z',
};

function buildOfficialDetailWithoutTickets() {
  return mapEventDetail(
    {
      id: 'event-official',
      status: 'published',
      title: 'Official Event',
      description: 'Clean official description',
      starts_at: '2026-10-16T20:00:00+02:00',
      ends_at: '2026-10-17T05:00:00+02:00',
      timezone: 'Europe/Berlin',
      image_url: 'https://example.com/flyer.png',
      official_url: 'https://example.com/events/official',
      venue_id: 'venue-1',
      organizer_name: 'BOOTSHAUS',
      created_by: null,
      published_at: '2026-08-14T08:00:00Z',
      created_at: '2026-08-14T08:00:00Z',
      updated_at: '2026-08-14T08:00:00Z',
    },
    venueRow,
    [
      {
        id: 'lineup-1',
        event_id: 'event-official',
        billing_name: '2 ENGEL & CHARLIE',
        billing_role: 'compound_act',
        sort_order: 0,
        created_at: '2026-08-14T08:00:00Z',
      },
    ],
    [],
    [],
  );
}

function buildM2DetailWithTicket() {
  return mapEventDetail(
    {
      id: 'event-m2',
      status: 'published',
      title: 'Eternal Rave Core Test',
      description: 'Roundtrip description',
      starts_at: '2026-09-05T18:00:00Z',
      ends_at: '2026-09-06T04:00:00Z',
      timezone: 'Europe/Berlin',
      image_url: null,
      official_url: null,
      venue_id: 'venue-1',
      organizer_name: 'Eternal Rave Test',
      created_by: null,
      published_at: '2026-08-14T08:00:00Z',
      created_at: '2026-08-14T08:00:00Z',
      updated_at: '2026-08-14T08:00:00Z',
    },
    venueRow,
    [
      {
        id: 'lineup-1',
        event_id: 'event-m2',
        billing_name: 'NOVA TEST',
        billing_role: 'headliner',
        sort_order: 0,
        created_at: '2026-08-14T08:00:00Z',
      },
    ],
    [],
    [
      {
        id: 'ticket-1',
        event_id: 'event-m2',
        provider: 'Eternal Rave Test',
        ticket_url: 'https://example.com/eternal-rave-core-test',
        price_from_minor: 1990,
        currency: 'EUR',
        sales_status: 'available',
        sort_order: 0,
        created_at: '2026-08-14T08:00:00Z',
        updated_at: '2026-08-14T08:00:00Z',
      },
    ],
  );
}

describe('consumer projection without ticket evidence', () => {
  it('shows no ticket affordance when the event has no ticket rows', () => {
    const display = toEventDisplayModelFromDetail(buildOfficialDetailWithoutTickets());
    const card = toEventCardViewModel(display);
    const listItem = toEventListItemViewModel(display);
    const ticketPresentation = resolvePublicTicketPresentation(display);

    expect(card.ticketLabel).toBeUndefined();
    expect(card.ticketStatus).toBeUndefined();
    expect(listItem.ticketLabel).toBeUndefined();
    expect(listItem.ticketStatus).toBeUndefined();
    expect(ticketPresentation.ticketLabel).toBeUndefined();
    expect(ticketPresentation.ticketStatus).toBeUndefined();
    expect(display.priceText).toBeUndefined();
    expect(display.ticketUrl).toBeUndefined();
    expect(display.officialEventUrl).toBe('https://example.com/events/official');
    expect(display.sourceLabel).toBe('Offizielle Eventseite von Example');
    expect(display.visibleSources).toEqual([
      {
        role: 'official_event',
        label: 'Offizielle Eventseite von Example',
        url: 'https://example.com/events/official',
      },
    ]);
  });

  it('keeps M2 ticket price and CTA when a ticket row exists', () => {
    const display = toEventDisplayModelFromDetail(buildM2DetailWithTicket());
    const card = toEventCardViewModel(display);

    expect(display.priceText).toBe('ab 19,90 €');
    expect(display.ticketUrl).toBe('https://example.com/eternal-rave-core-test');
    expect(card.ticketLabel).toBe('ab 19,90 €');
    expect(card.ticketStatus).toBe('available');
  });

  it('never surfaces internal lineup role keys in display models', () => {
    const detail = buildOfficialDetailWithoutTickets();
    const display = toEventDisplayModelFromDetail(detail);

    expect(display.lineup).toEqual(['2 ENGEL & CHARLIE']);
    expect(JSON.stringify(display)).not.toContain('compound_act');
    expect(JSON.stringify(display)).not.toContain('headliner');
  });
});
