import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { extractVisibleAdmissionPriceFromTicketIoBody } from '../extract-visible-admission-price';
import { buildTicketPriceEvidence, hasVerifiedPriceAmount } from '../ticket-price-evidence';
import { classifyTicketOffer } from '../ticket-offer-role';
import { selectRegularAdmissionOffer } from '../select-regular-admission-offer';
import type { EventTicketEvidence } from '../types';

const FIXTURE_DIR = join(__dirname, 'fixtures');

function buildEvidence(offers: EventTicketEvidence['offers']): EventTicketEvidence {
  const observedAt = new Date().toISOString();
  return {
    providerKey: 'ticket_io',
    providerIdentity: {
      providerKey: 'ticket_io',
      providerEventId: 'test',
      identityKey: 'ticket_io:test',
    },
    sourceUrl: 'https://bootshaus-club.ticket.io/example/',
    canonicalTicketUrl: 'https://bootshaus-club.ticket.io/example/',
    sourceObservedAt: observedAt,
    extractedAt: observedAt,
    contentFingerprint: 'test',
    eventIdentityEvidence: {},
    offers,
    normalizedStatus: 'available',
    statusLabel: 'Tickets verfügbar',
    rejectedOffers: [],
    confidence: 0.9,
  };
}

describe('admission classification — M9.2.2.5B', () => {
  it('classifies Doorsale and Blind Ticket as regular admission', () => {
    expect(classifyTicketOffer({ label: 'Doorsale' }).grantsEventEntry).toBe(true);
    expect(classifyTicketOffer({ label: 'Blind Ticket' }).grantsEventEntry).toBe(true);
  });

  it('keeps lockers and parking as non-admission', () => {
    expect(classifyTicketOffer({ label: 'Locker - Size: M' }).grantsEventEntry).toBe(false);
    expect(classifyTicketOffer({ label: 'Parkticket – Claudius Therme' }).grantsEventEntry).toBe(false);
  });

  it('B — selects Blind Ticket over locker add-ons', () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-nye-blind-ticket.html'), 'utf8');
    const extracted = extractVisibleAdmissionPriceFromTicketIoBody(
      html,
      'https://bootshaus-club.ticket.io/S0cbXDda/',
    );
    expect(extracted.amountMinor).toBe(2990);
    expect(extracted.productLabel).toBe('Blind Ticket');
  });

  it('C — selects active phase 2 over sold-out phase 1', () => {
    const selected = selectRegularAdmissionOffer(
      buildEvidence([
        {
          rawLabel: 'Phase 1',
          role: 'regular_admission',
          amountMinor: 1800,
          currency: 'EUR',
          availability: 'sold_out',
        },
        {
          rawLabel: 'Phase 2',
          role: 'regular_admission',
          amountMinor: 2000,
          currency: 'EUR',
          availability: 'available',
        },
      ]),
    );
    expect(selected?.amountMinor).toBe(2000);
  });

  it('D — prefers regular admission over VIP premium', () => {
    const selected = selectRegularAdmissionOffer(
      buildEvidence([
        {
          rawLabel: 'VIP Ticket',
          role: 'vip_admission',
          amountMinor: 7000,
          currency: 'EUR',
          availability: 'available',
        },
        {
          rawLabel: 'Regular Ticket',
          role: 'regular_admission',
          amountMinor: 3000,
          currency: 'EUR',
          availability: 'available',
        },
      ]),
    );
    expect(selected?.rawLabel).toBe('Regular Ticket');
    expect(selected?.amountMinor).toBe(3000);
  });

  it('A — fails price evidence when rendered price exists but parser selected none', () => {
    const evidence = buildEvidence([
      {
        rawLabel: 'Locker - Size: M',
        role: 'locker',
        amountMinor: 800,
        currency: 'EUR',
        availability: 'available',
      },
    ]);
    const priceEvidence = buildTicketPriceEvidence({ ticketEvidence: evidence, soldOut: false });
    expect(hasVerifiedPriceAmount(priceEvidence.state)).toBe(false);
    expect(priceEvidence.reason).toBe('regular_price_not_exposed_by_provider');
  });

  it('parses Chris Stussy Doorsale from shop table fixture', () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-chris-stussy-doorsale.html'), 'utf8');
    const extracted = extractVisibleAdmissionPriceFromTicketIoBody(
      html,
      'https://bootshaus-club.ticket.io/By06xnf4/',
    );
    expect(extracted.amountMinor).toBe(4500);
    expect(extracted.productLabel).toBe('Doorsale');
  });
});
