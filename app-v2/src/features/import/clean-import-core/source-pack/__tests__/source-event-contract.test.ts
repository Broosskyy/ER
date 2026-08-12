import { describe, expect, it } from 'vitest';

import { validateSourceEvent } from '../source-event-validation';

describe('source-event contract', () => {
  it('rejects ticket URL in websiteUrl', () => {
    const issues = validateSourceEvent({
      title: 'Test Night',
      websiteUrl: 'https://shop.ticket.io/event/abc/',
      verifiedAt: '2026-08-11T20:00:00.000Z',
    });
    expect(issues.some((issue) => issue.code === 'ticket_url_in_website_url')).toBe(true);
  });

  it('rejects full address in venueCity', () => {
    const issues = validateSourceEvent({
      venueCity: 'Auenweg 173, 51063 Köln',
      verifiedAt: '2026-08-11T20:00:00.000Z',
    });
    expect(issues.some((issue) => issue.code === 'full_address_in_venue_city')).toBe(true);
  });

  it('rejects add-on prices as admission', () => {
    const issues = validateSourceEvent({
      priceText: 'Parking ab 5,00 €',
      verifiedAt: '2026-08-11T20:00:00.000Z',
    });
    expect(issues.some((issue) => issue.code === 'add_on_used_as_admission_price')).toBe(true);
  });
});
