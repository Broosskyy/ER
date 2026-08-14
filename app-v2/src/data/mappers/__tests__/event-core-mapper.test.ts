import { describe, expect, it } from 'vitest';

import {
  mapEventDetail,
  mapEventSummary,
  sortEventSummariesChronologically,
} from '@/data/mappers/event-core-mapper';

const venueRow = {
  id: 'venue-1',
  name: 'Eternal Rave Test Venue',
  address_line: null,
  postal_code: null,
  city: 'Köln',
  country_code: 'DE',
  latitude: null,
  longitude: null,
  official_url: null,
  created_at: '2026-08-14T08:00:00Z',
  updated_at: '2026-08-14T08:00:00Z',
};

const eventRow = {
  id: 'event-1',
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
};

const lineupRows = [
  {
    id: 'lineup-1',
    event_id: 'event-1',
    billing_name: 'NOVA TEST',
    billing_role: 'headliner',
    sort_order: 0,
    created_at: '2026-08-14T08:00:00Z',
  },
  {
    id: 'lineup-2',
    event_id: 'event-1',
    billing_name: 'ALPHA & BETA',
    billing_role: 'compound_act',
    sort_order: 1,
    created_at: '2026-08-14T08:00:00Z',
  },
  {
    id: 'lineup-3',
    event_id: 'event-1',
    billing_name: 'KLANG TEST',
    billing_role: 'artist',
    sort_order: 2,
    created_at: '2026-08-14T08:00:00Z',
  },
];

const genreRows = [
  {
    id: 'genre-1',
    event_id: 'event-1',
    genre_key: 'techno',
    display_name: 'Techno',
    raw_label: null,
    sort_order: 0,
    created_at: '2026-08-14T08:00:00Z',
  },
  {
    id: 'genre-2',
    event_id: 'event-1',
    genre_key: 'hard-techno',
    display_name: 'Hard Techno',
    raw_label: null,
    sort_order: 1,
    created_at: '2026-08-14T08:00:00Z',
  },
];

const ticketRows = [
  {
    id: 'ticket-1',
    event_id: 'event-1',
    provider: 'Eternal Rave Test',
    ticket_url: 'https://example.com/eternal-rave-core-test',
    price_from_minor: 1990,
    currency: 'EUR',
    sales_status: 'available',
    sort_order: 0,
    created_at: '2026-08-14T08:00:00Z',
    updated_at: '2026-08-14T08:00:00Z',
  },
];

describe('event-core-mapper', () => {
  it('maps Supabase rows to EventSummary', () => {
    const summary = mapEventSummary(eventRow, venueRow, genreRows, ticketRows);

    expect(summary.id).toBe('event-1');
    expect(summary.title).toBe('Eternal Rave Core Test');
    expect(summary.venue?.city).toBe('Köln');
    expect(summary.genres).toHaveLength(2);
    expect(summary.primaryTicket?.priceFromMinor).toBe(1990);
  });

  it('maps Supabase rows to EventDetail with billing order preserved', () => {
    const detail = mapEventDetail(eventRow, venueRow, lineupRows, genreRows, ticketRows);

    expect(detail.lineup.map((act) => act.billingName)).toEqual([
      'NOVA TEST',
      'ALPHA & BETA',
      'KLANG TEST',
    ]);
    expect(detail.lineup[1]?.billingRole).toBe('compound_act');
    expect(detail.genres).toHaveLength(2);
    expect(detail.tickets[0]?.salesStatus).toBe('available');
  });

  it('keeps compound act as a single lineup row', () => {
    const detail = mapEventDetail(eventRow, venueRow, lineupRows, genreRows, ticketRows);
    const compoundActs = detail.lineup.filter((act) => act.billingName.includes('&'));

    expect(compoundActs).toHaveLength(1);
    expect(compoundActs[0]?.billingName).toBe('ALPHA & BETA');
  });

  it('sorts summaries chronologically by startsAt', () => {
    const later = mapEventSummary(
      { ...eventRow, id: 'event-2', starts_at: '2026-10-01T18:00:00Z' },
      venueRow,
      [],
      [],
    );
    const earlier = mapEventSummary(eventRow, venueRow, [], []);

    expect(
      sortEventSummariesChronologically([later, earlier]).map((summary) => summary.id),
    ).toEqual(['event-1', 'event-2']);
  });
});
