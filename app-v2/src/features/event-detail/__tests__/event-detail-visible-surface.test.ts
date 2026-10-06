import { describe, expect, it } from 'vitest';

import { shouldCollapseDescription } from '@/components/layout/expandable-text-logic';
import { mapEventDetail } from '@/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '@/data/mappers/event-core-display';
import { buildEventDetailVisibleSurface } from '@/features/event-detail/event-detail-visible-surface';

describe('event detail visible surface', () => {
  it('does not render raw ticket enums or an unverified organizer website', () => {
    const detail = mapEventDetail(
      {
        id: 'zaagstep',
        status: 'published',
        title: 'ZAAGSTEP',
        description: 'BLACKLIST & INURFASE pres.',
        starts_at: '2026-09-05T18:00:00Z',
        ends_at: null,
        timezone: 'Europe/Berlin',
        image_url: null,
        official_url: 'https://bootshaus.tv/events/blacklist-inurfase-pres-zaagstep-by-dr-donk/',
        venue_id: 'venue-1',
        organizer_name: 'INURFASE',
        created_by: null,
        published_at: '2026-08-14T08:00:00Z',
        created_at: '2026-08-14T08:00:00Z',
        updated_at: '2026-08-14T08:00:00Z',
      },
      {
        id: 'venue-1',
        name: 'Bootshaus',
        address_line: null,
        postal_code: null,
        city: 'Köln',
        country_code: 'DE',
        latitude: null,
        longitude: null,
        official_url: 'https://bootshaus.tv/',
        created_at: '2026-08-14T08:00:00Z',
        updated_at: '2026-08-14T08:00:00Z',
      },
      [],
      [],
      [
        {
          id: 'ticket-1',
          event_id: 'zaagstep',
          provider: 'ticket_io',
          ticket_url: 'https://example.ticket.io/abc/',
          price_from_minor: null,
          currency: 'EUR',
          sales_status: 'available',
          sort_order: 0,
          created_at: '2026-08-14T08:00:00Z',
          updated_at: '2026-08-14T08:00:00Z',
        },
      ],
    );
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);

    expect(surface.officialSourceLabel).toBe('Offizielle Eventseite von Bootshaus');
    expect(surface.officialSourceUrl).toContain('bootshaus.tv/events/');
    expect(surface.organizerName).toBe('INURFASE');
    expect(surface.organizerWebsiteUrl).toBeNull();
    expect(surface.priceText).toBeNull();
    expect(surface.statusLabel).toBe('Verfügbar');
    expect(surface.ticketBadgeStatus).toBe('available');
    expect(surface.purchaseCtaLabel).toBe('Tickets kaufen');
    expect(surface.visibleText).not.toContain('Website ↗');
    expect(surface.rawTicketStatusValuesRendered).toBe(0);
    expect(surface.technicalProviderStatesRendered).toBe(0);
  });

  it('collapses long descriptions in the visible surface contract', () => {
    const longDescription = Array.from({ length: 10 }, (_, index) => `Paragraph ${index + 1}`).join('\n');
    expect(shouldCollapseDescription(longDescription)).toBe(true);
    expect(shouldCollapseDescription('Short teaser only.')).toBe(false);
  });
});
