import { describe, expect, it } from 'vitest';

import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import {
  dedupeTicketPhases,
  deriveSummaryPriceTextFromPhases,
  deriveTicketStatusFromPhases,
  mergeTicketPhases,
  normalizeSourceTicketOffer,
  normalizeTicketOffersFromCandidate,
  sortTicketPhases,
} from '@/features/import/domain/canonical-ticket-phase';

function baseCandidate(
  overrides: Partial<CanonicalImportEvent> = {},
): CanonicalImportEvent {
  return {
    externalId: 'ext-1',
    sourceId: 'source-1',
    sourceName: 'Ticket.io',
    title: 'Test Event',
    startDate: '2026-08-01T22:00:00+02:00',
    rawSourceType: 'json_ld',
    ...overrides,
  };
}

describe('canonical ticket phases', () => {
  it('orders phases deterministically', () => {
    const phases = sortTicketPhases([
      normalizeSourceTicketOffer({ name: 'VIP' }, 0),
      normalizeSourceTicketOffer({ name: 'Early Bird' }, 1),
      normalizeSourceTicketOffer({ name: 'Phase 1' }, 2),
    ]);
    expect(phases.map((phase) => phase.kind)).toEqual(['early_bird', 'phase_1', 'vip']);
  });

  it('does not mark entire event sold out when one phase is sold out', () => {
    const phases = [
      normalizeSourceTicketOffer({ name: 'Early Bird', priceAmount: 10, soldOut: true }, 0),
      normalizeSourceTicketOffer({ name: 'Regular', priceAmount: 20, soldOut: false }, 1),
    ];
    expect(deriveTicketStatusFromPhases(phases)).toBe('on_sale');
    expect(deriveSummaryPriceTextFromPhases(phases)).toMatch(/20/);
  });

  it('marks all phases sold out', () => {
    const phases = [
      normalizeSourceTicketOffer({ name: 'Early Bird', soldOut: true }, 0),
      normalizeSourceTicketOffer({ name: 'Regular', soldOut: true }, 1),
    ];
    expect(deriveTicketStatusFromPhases(phases)).toBe('sold_out');
    expect(deriveSummaryPriceTextFromPhases(phases)).toBe('Ausverkauft');
  });

  it('treats explicit free semantics correctly', () => {
    const phases = [
      normalizeSourceTicketOffer({ name: 'Kostenlos', priceAmount: 0 }, 0),
    ];
    expect(deriveSummaryPriceTextFromPhases(phases)).toBe('Kostenlos');
  });

  it('treats missing price as not free', () => {
    const phases = [
      normalizeSourceTicketOffer({ name: 'Regular' }, 0),
    ];
    expect(deriveSummaryPriceTextFromPhases(phases)).toBeUndefined();
  });

  it('treats abendkasse without numeric value as note', () => {
    const phases = [
      normalizeSourceTicketOffer({ name: 'Abendkasse' }, 0),
    ];
    expect(phases[0]?.note).toBe('Abendkasse');
    expect(deriveSummaryPriceTextFromPhases(phases)).toBe('Abendkasse');
  });

  it('deduplicates duplicate offers', () => {
    const duplicate = normalizeSourceTicketOffer({ name: 'Regular', priceAmount: 15 }, 0);
    const richer = normalizeSourceTicketOffer(
      { name: 'Regular', priceAmount: 15, purchaseUrl: 'https://shop.ticket.io/event/' },
      1,
    );
    const merged = dedupeTicketPhases([duplicate, richer]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.purchaseUrl).toContain('ticket.io');
  });

  it('mergeTicketPhases unions phases for legacy callers (atomic replace lives in writer)', () => {
    const existing = [
      normalizeSourceTicketOffer({ name: 'Regular', priceAmount: 20, purchaseUrl: 'https://a' }, 0),
    ];
    const incoming = [
      normalizeSourceTicketOffer({ name: 'Regular', priceAmount: 15 }, 0),
    ];
    const merged = mergeTicketPhases(existing, incoming, { fillOnly: true });
    expect(merged).toHaveLength(2);
  });

  it('normalizes ticket offers from candidate sourceMetadata', () => {
    const candidate = baseCandidate({
      sourceMetadata: {
        ticketOffers: [
          { name: 'Phase 1', priceAmount: 12, priceCurrency: 'EUR' },
          { name: 'Phase 2', priceAmount: 18, priceCurrency: 'EUR', soldOut: true },
        ],
      },
    });
    const phases = normalizeTicketOffersFromCandidate(candidate);
    expect(phases?.length).toBe(2);
    expect(phases?.[1]?.soldOut).toBe(true);
  });

  it('idempotent republish keeps equivalent phases', () => {
    const candidate = baseCandidate({
      sourceMetadata: {
        ticketOffers: [{ name: 'Regular', priceAmount: 16.9, priceCurrency: 'EUR' }],
      },
    });
    const first = normalizeTicketOffersFromCandidate(candidate);
    const second = normalizeTicketOffersFromCandidate(candidate);
    expect(mergeTicketPhases(first, second)).toEqual(first);
  });
});

describe('consumer projection parity helpers', () => {
  it('derives min/max summary only from available priced phases', () => {
    const phases = [
      normalizeSourceTicketOffer({ name: 'Early Bird', priceAmount: 10, soldOut: true }, 0),
      normalizeSourceTicketOffer({ name: 'Regular', priceAmount: 25 }, 1),
      normalizeSourceTicketOffer({ name: 'VIP', priceAmount: 40 }, 2),
    ];
    expect(deriveSummaryPriceTextFromPhases(phases)).toMatch(/25/);
    expect(deriveSummaryPriceTextFromPhases(phases)).toMatch(/40/);
  });
});
