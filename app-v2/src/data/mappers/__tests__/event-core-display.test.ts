import { describe, expect, it } from 'vitest';

import { toEventDisplayModelFromDetail } from '@/data/mappers/event-core-display';
import { mapEventDetail } from '@/data/mappers/event-core-mapper';

function buildDetail() {
  return mapEventDetail(
    {
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
    },
    {
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
    },
    [
      {
        id: 'lineup-2',
        event_id: 'event-1',
        billing_name: 'ALPHA & BETA',
        billing_role: 'compound_act',
        sort_order: 1,
        created_at: '2026-08-14T08:00:00Z',
      },
    ],
    [
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
    ],
    [
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
    ],
  );
}

describe('event-core-display', () => {
  it('projects ticket price and genres for cards and detail', () => {
    const display = toEventDisplayModelFromDetail(buildDetail());

    expect(display.title).toBe('Eternal Rave Core Test');
    expect(display.venue).toBe('Eternal Rave Test Venue');
    expect(display.city).toBe('Köln');
    expect(display.genres).toEqual(['Techno', 'Hard Techno']);
    expect(display.priceText).toBe('ab 19,90 €');
    expect(display.ticketUrl).toBe('https://example.com/eternal-rave-core-test');
    expect(display.lineup).toEqual(['ALPHA & BETA']);
    expect(display.officialEventUrl).toBeUndefined();
    expect(display.officialSourceMissing).toBe(true);
  });

  it('uses an empty image placeholder when image_url is missing', () => {
    const display = toEventDisplayModelFromDetail(buildDetail());
    expect(display.image).toEqual({ uri: '' });
  });

  it('projects official image_url when present', () => {
    const detail = mapEventDetail(
      {
        id: 'event-official',
        status: 'published',
        title: 'Official Image Event',
        description: 'Official description',
        starts_at: '2026-10-16T20:00:00+02:00',
        ends_at: '2026-10-17T05:00:00+02:00',
        timezone: 'Europe/Berlin',
        image_url: 'https://example.com/official-flyer.png',
        official_url: 'https://example.com/events/official',
        venue_id: 'venue-1',
        organizer_name: 'BOOTSHAUS',
        created_by: null,
        published_at: '2026-08-14T08:00:00Z',
        created_at: '2026-08-14T08:00:00Z',
        updated_at: '2026-08-14T08:00:00Z',
      },
      {
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
      },
      [],
      [],
      [],
    );
    const display = toEventDisplayModelFromDetail(detail);

    expect(display.image).toEqual({ uri: 'https://example.com/official-flyer.png' });
    expect(display.officialEventUrl).toBe('https://example.com/events/official');
    expect(display.sourceLabel).toBe('Offizielle Eventseite von Example');
    expect(display.sourceUrl).toBe('https://example.com/events/official');
    expect(display.sourceImageUrl).toBe('https://example.com/official-flyer.png');
    expect(display.visibleSources?.[0]?.role).toBe('official_event');
    expect(display.priceText).toBeUndefined();
    expect(display.ticketStatus).toBeUndefined();
    expect(display.genres).toEqual([]);
  });
});
