import { describe, expect, it } from 'vitest';

import { resolveDomainVenueLabel, resolveEventVenueDisplay } from '@/features/create/utils/event-venue-display';
import { mapEventRowToDomain } from '@/data/mappers/event-mapper';

describe('resolveDomainVenueLabel', () => {
  it('prefers joined venue name over suggestion fields', () => {
    expect(
      resolveDomainVenueLabel({
        joinedVenueName: 'Bootshaus',
        venueName: 'Secret Warehouse',
        venueCity: 'Köln',
      }),
    ).toBe('Bootshaus');
  });

  it('falls back to venue suggestion when no venue FK join exists', () => {
    expect(
      resolveDomainVenueLabel({
        venueName: 'Secret Warehouse',
        venueCity: 'Köln',
      }),
    ).toBe('Secret Warehouse, Köln');
  });

  it('returns TBA when no venue data is available', () => {
    expect(resolveDomainVenueLabel({})).toBe('TBA');
  });
});

describe('mapEventRowToDomain venue suggestion', () => {
  it('maps contributor venue suggestions into the consumer venue field', () => {
    const event = mapEventRowToDomain(
      {
        id: 'evt-1',
        title: 'Test',
        subtitle: null,
        description: 'Desc',
        genre_id: null,
        venue_id: null,
        city_id: null,
        artist_id: null,
        source_id: null,
        collection_id: null,
        start_date: '2026-08-01T20:00:00Z',
        end_date: null,
        ticket_url: null,
        website_url: null,
        instagram_url: null,
        facebook_url: null,
        image_url: null,
        flyer_url: null,
        venue_name: 'Secret Warehouse',
        venue_city: 'Köln',
        status: 'published',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {},
    );

    expect(event.venue).toBe('Secret Warehouse, Köln');
    expect(event.city).toBe('Köln');
  });
});

describe('resolveEventVenueDisplay', () => {
  it('marks free-text venues as suggestions', () => {
    expect(
      resolveEventVenueDisplay(
        { venueId: undefined, venueName: 'Secret Warehouse', venueCity: 'Köln' },
        [],
      ),
    ).toEqual({ label: 'Secret Warehouse, Köln', isSuggestion: true });
  });
});
