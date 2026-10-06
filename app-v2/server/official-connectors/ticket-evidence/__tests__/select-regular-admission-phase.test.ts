import { describe, expect, it } from 'vitest';

import { selectRegularAdmissionOffer } from '../select-regular-admission-offer';
import type { EventTicketEvidence } from '../types';

function buildEvidence(offers: EventTicketEvidence['offers']): EventTicketEvidence {
  return {
    providerKey: 'ticket_kings',
    sourceUrl: 'https://example.ticketkings.de/event',
    offers,
    observedAt: new Date().toISOString(),
  };
}

describe('selectRegularAdmissionOffer phase freshness', () => {
  it('selects current purchasable phase over cheaper sold-out early tier', () => {
    const selected = selectRegularAdmissionOffer(
      buildEvidence([
        {
          rawLabel: 'E-Ticket Phase 1',
          phaseLabel: 'Phase 1',
          role: 'regular_admission',
          amountMinor: 1800,
          currency: 'EUR',
          availability: 'sold_out',
        },
        {
          rawLabel: 'E-Ticket Phase 2',
          phaseLabel: 'Phase 2',
          role: 'regular_admission',
          amountMinor: 2000,
          currency: 'EUR',
          availability: 'available',
        },
      ]),
    );
    expect(selected?.phaseLabel).toBe('Phase 2');
    expect(selected?.amountMinor).toBe(2000);
  });
});
