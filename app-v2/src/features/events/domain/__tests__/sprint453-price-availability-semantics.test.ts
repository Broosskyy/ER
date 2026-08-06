import { describe, expect, it } from 'vitest';

import {
  isSemanticallyFreeEvent,
  resolveEventPriceAvailabilitySemantics,
} from '@/features/events/domain/event-price-availability-semantics';

describe('event price availability semantics', () => {
  it('does not treat missing price as free', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({});
    expect(semantics.priceState).toBe('unknown');
    expect(isSemanticallyFreeEvent({})).toBe(false);
  });

  it('does not treat bare zero as free without explicit semantics', () => {
    expect(resolveEventPriceAvailabilitySemantics({ priceText: '0' }).priceState).toBe('unknown');
    expect(resolveEventPriceAvailabilitySemantics({ priceText: '0 €' }).priceState).toBe('unknown');
  });

  it('treats explicit free wording as free', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({ priceText: 'Kostenlos' });
    expect(semantics.priceState).toBe('free');
    expect(semantics.colorToken).toBe('success');
  });

  it('detects sold-out from price text without clearing paid state', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({ priceText: 'Ausverkauft' });
    expect(semantics.availabilityState).toBe('sold_out');
    expect(semantics.priceState).toBe('unavailable');
    expect(semantics.showAvailabilityBadge).toBe(true);
  });

  it('keeps event available when one phase is sold out but another remains', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({
      priceText: 'ab 20,00 €',
      ticketPhases: [
        { label: 'Early Bird', soldOut: true },
        { label: 'Regular', soldOut: false, available: true },
      ],
    });
    expect(semantics.availabilityState).toBe('available');
    expect(semantics.priceState).toBe('paid');
  });

  it('marks fully sold-out phases as sold out', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({
      priceText: 'ab 20,00 €',
      ticketPhases: [
        { label: 'Early Bird', soldOut: true },
        { label: 'Regular', soldOut: true },
      ],
    });
    expect(semantics.availabilityState).toBe('sold_out');
  });

  it('treats Abendkasse without number as ticket note, not numeric price', () => {
    const semantics = resolveEventPriceAvailabilitySemantics({ priceText: 'Abendkasse' });
    expect(semantics.priceState).toBe('unknown');
    expect(semantics.explanatoryLabel).toBe('Abendkasse');
    expect(semantics.showPrice).toBe(false);
  });
});
