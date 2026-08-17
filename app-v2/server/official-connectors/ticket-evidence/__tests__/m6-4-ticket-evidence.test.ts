import { describe, expect, it } from 'vitest';

import { classifyTicketActionKind } from '../ticket-action';
import { berlinCalendarDay } from '../ticket-lifecycle';
import { buildTicketPriceEvidence, formatConsumerPriceLabel } from '../ticket-price-evidence';
import { verifyTicketIdentity } from '../ticket-identity-verify';
import { canonicalizeTicketIoUrl } from '../url-policy';

describe('M6.4 ticket price evidence state', () => {
  it('marks provider blocked as provider_access_unavailable', () => {
    const price = buildTicketPriceEvidence({ providerBlocked: true });
    expect(price.state).toBe('provider_access_unavailable');
    expect(price.amountMinor).toBeUndefined();
    expect(formatConsumerPriceLabel(price)).toBe('Preis beim Anbieter prüfen');
  });

  it('uses historical capture when current admission price missing', () => {
    const price = buildTicketPriceEvidence({
      historicalCapture: {
        amountMinor: 3000,
        currency: 'EUR',
        rawPriceText: 'ab 30,00 EUR',
        sourceUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
        sourceObservedAt: '2026-08-15T12:00:00.000Z',
        contentFingerprint: 'abc123',
      },
    });
    expect(price.state).toBe('verified_historical');
    expect(price.amountMinor).toBe(3000);
    expect(formatConsumerPriceLabel(price)).toContain('zuletzt');
  });

  it('prefers historical capture for ended events', () => {
    const price = buildTicketPriceEvidence({
      eventEnded: true,
      ticketEvidence: {
        providerKey: 'ticket_io',
        providerIdentity: {
          providerKey: 'ticket_io',
          providerEventId: 'wrong',
          providerScope: 'shop.ticket.io',
          identityKey: 'ticket_io:shop.ticket.io:wrong',
        },
        sourceUrl: 'https://shop.ticket.io/wrong/',
        canonicalTicketUrl: 'https://shop.ticket.io/wrong/',
        sourceObservedAt: '2026-08-17T00:00:00.000Z',
        extractedAt: '2026-08-17T00:00:00.000Z',
        contentFingerprint: 'wrong',
        eventIdentityEvidence: {},
        offers: [
          {
            rawLabel: 'Admission',
            amountMinor: 9999,
            currency: 'EUR',
            role: 'admission',
            availability: 'available',
            confidence: 0.9,
          },
        ],
        normalizedStatus: 'available',
        statusLabel: 'Tickets verfügbar',
        rejectedOffers: [],
        confidence: 0.9,
      },
      historicalCapture: {
        amountMinor: 3400,
        currency: 'EUR',
        rawPriceText: 'ab 34,9 EUR',
        sourceUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
        sourceObservedAt: '2026-08-16T19:53:41.518Z',
        contentFingerprint: 'f921c4318cefeacdcde87196f1e8f404c1f26ae7128fecf11016bb2a7b8ca454',
      },
    });
    expect(price.state).toBe('verified_historical');
    expect(price.amountMinor).toBe(3400);
  });
});

describe('M6.4 presale registration classification', () => {
  it('classifies sibforms redirect as presale_registration', () => {
    const kind = classifyTicketActionKind(
      {
        rawUrl: 'https://bit.ly/ZAAGSTEP',
        relation: 'official_ticket',
        discoveredOnUrl: 'https://bootshaus.tv/events/test',
        discoveredFromSource: 'a[href]',
        observedAt: '2026-08-16T00:00:00.000Z',
        elementText: 'Tickets',
      },
      {
        discovered: {
          rawUrl: 'https://bit.ly/ZAAGSTEP',
          relation: 'official_ticket',
          discoveredOnUrl: 'https://bootshaus.tv/events/test',
          discoveredFromSource: 'a[href]',
          observedAt: '2026-08-16T00:00:00.000Z',
        },
        resolvedUrl: 'https://73b85ec6.sibforms.com/serve/test',
        canonicalTicketUrl: 'https://73b85ec6.sibforms.com/serve/test',
        providerKey: 'organizer_shop',
        redirectChain: [],
        isEventDetailUrl: false,
      },
    );
    expect(kind).toBe('presale_registration');
  });
});

describe('M6.4 ticket.io canonicalization', () => {
  it('strips _gl tracking from ticket.io urls', () => {
    const canonical = canonicalizeTicketIoUrl(
      'https://nibirii-festival.ticket.io/uw3dsjtw/?_gl=1*abc*_ga*test',
    );
    expect(canonical).toBe('https://nibirii-festival.ticket.io/uw3dsjtw/');
  });
});

describe('M6.4 timezone identity window', () => {
  it('accepts provider dates within the same Berlin calendar day', () => {
    const result = verifyTicketIdentity({
      providerEventId: 'ebqBfbhC',
      shopHost: 'musical-madness.ticket.io',
      providerTitle: 'Into The Madness Pre-Party',
      providerStartAt: '2026-09-18T22:00:00+02:00',
      providerVenue: 'Bootshaus',
      officialTitle: 'Into The Madness Pre-Party Weekender w. RAN - D and more!',
      officialStartAt: '2026-09-19T22:00:00+02:00',
      officialVenue: 'Bootshaus',
      canonicalTicketUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
    });
    expect(result.result).not.toBe('ticket_identity_conflict');
  });

  it('formats berlin calendar day', () => {
    expect(berlinCalendarDay('2026-09-19T22:00:00+02:00')).toBe('2026-09-19');
  });
});
