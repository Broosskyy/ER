import { describe, expect, it } from 'vitest';

import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { resolveEventPriceAvailabilitySemantics, toDiscoveryTicketStatus } from '@/features/events/domain/event-price-availability-semantics';

describe('phase4742 consumer completion', () => {
  it('maps canonical availability states to ticket badges', () => {
    expect(mapCanonicalAvailabilityToTicketBadge('sold_out')).toBe('sold_out');
    expect(mapCanonicalAvailabilityToTicketBadge('presale')).toBe('presale');
    expect(mapCanonicalAvailabilityToTicketBadge('waitlist')).toBe('waitlist');
    expect(mapCanonicalAvailabilityToTicketBadge('available', 'on_sale')).toBe('on_sale');
  });

  it('projects flyer and hero image into gallery without duplicates', () => {
    const canonical = projectCanonicalEventFields({
      title: 'Test',
      description: 'desc',
      venue: 'Bootshaus',
      city: 'Köln',
      artists: [],
      source: 'test',
      imageUrl: 'https://cdn.example/hero.jpg',
      imageUrls: ['https://cdn.example/flyer.jpg', 'https://cdn.example/hero.jpg'],
    });
    expect(canonical.galleryImageUrls).toEqual([
      'https://cdn.example/flyer.jpg',
      'https://cdn.example/hero.jpg',
    ]);
  });

  it('derives on_sale badge semantics from paid price and on_sale status', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({
      priceText: 'ab 25,00 €',
      ticketAvailability: 'on_sale',
    });
    expect(toDiscoveryTicketStatus(semantics)).toBe('available');
  });
});
