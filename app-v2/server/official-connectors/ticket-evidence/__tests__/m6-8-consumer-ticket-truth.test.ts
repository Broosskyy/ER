import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FourvenuesEvidenceProvider } from '../fourvenues-evidence-provider';
import { selectRegularAdmissionOffer } from '../select-regular-admission-offer';
import { classifyTicketOfferRole, isRegularAdmissionOfferRole } from '../ticket-offer-role';
import { evaluateTicketTargetIdentity } from '../ticket-target-identity';
import { hasActivePurchaseCta } from '../consumer-ticket-safety-gate';
import type { EventTicketEvidence } from '../types';

const FIXTURE_DIR = join(__dirname, 'fixtures');

describe('regular admission offer selection', () => {
  it('excludes sold-out early bird, VIP and table tiers', () => {
    expect(classifyTicketOfferRole('VIP Table ab 200 €')).toBe('table');
    expect(isRegularAdmissionOfferRole('vip_admission')).toBe(false);
    expect(isRegularAdmissionOfferRole('upgrade')).toBe(false);

    const evidence: EventTicketEvidence = {
      providerKey: 'fourvenues',
      providerIdentity: {
        providerKey: 'fourvenues',
        providerEventId: '122---amok-x-bootshaus-17-08-2026-RD7M',
        providerScope: 'site.fourvenues.com',
        identityKey: 'fourvenues:site.fourvenues.com:122---amok-x-bootshaus-17-08-2026-RD7M',
      },
      sourceUrl: 'https://site.fourvenues.com/en/bootshaus/events/122---amok-x-bootshaus-17-08-2026-RD7M',
      canonicalTicketUrl: 'https://site.fourvenues.com/en/bootshaus/events/122---amok-x-bootshaus-17-08-2026-RD7M',
      sourceObservedAt: '2026-08-17T12:00:00.000Z',
      extractedAt: '2026-08-17T12:00:01.000Z',
      contentFingerprint: 'fixture',
      eventIdentityEvidence: {},
      offers: [
        {
          rawLabel: 'Early Bird',
          normalizedLabel: 'Early Bird',
          rawPrice: 'ab 12,00 €',
          amountMinor: 1200,
          currency: 'EUR',
          role: 'regular_admission',
          availability: 'sold_out',
          confidence: 0.85,
        },
        {
          rawLabel: 'First Release',
          normalizedLabel: 'First Release',
          rawPrice: 'ab 15,00 €',
          amountMinor: 1500,
          currency: 'EUR',
          role: 'regular_admission',
          availability: 'available',
          confidence: 0.85,
        },
        {
          rawLabel: 'VIP',
          normalizedLabel: 'VIP',
          rawPrice: 'ab 60,00 €',
          amountMinor: 6000,
          currency: 'EUR',
          role: 'vip_admission',
          availability: 'available',
          confidence: 0.85,
        },
        {
          rawLabel: 'VIP Table',
          normalizedLabel: 'VIP Table',
          rawPrice: 'ab 200,00 €',
          amountMinor: 20000,
          currency: 'EUR',
          role: 'table',
          availability: 'available',
          confidence: 0.85,
        },
      ],
      normalizedStatus: 'available',
      statusLabel: 'Tickets verfügbar',
      rejectedOffers: [],
      confidence: 0.85,
    };

    const selected = selectRegularAdmissionOffer(evidence);

    expect(selected?.rawLabel).toBe('First Release');
    expect(selected?.amountMinor).toBe(1500);
    expect(selected?.availability).toBe('available');
  });

  it('parses fourvenues fixture tiers from public HTML', async () => {
    const html = readFileSync(join(FIXTURE_DIR, 'fourvenues-kaz-james.html'), 'utf8');
    const provider = new FourvenuesEvidenceProvider();
    const url = 'https://site.fourvenues.com/en/bootshaus/events/122---amok-x-bootshaus-17-08-2026-RD7M';
    const providerEvidence = await provider.fetchEventEvidence({
      url: new URL(url),
      canonicalTicketUrl: url,
      redirectChain: [url],
      body: html,
      contentType: 'text/html',
      fingerprint: 'fixture',
      observedAt: '2026-08-17T12:00:00.000Z',
      extractedAt: '2026-08-17T12:00:01.000Z',
    });
    const selected = selectRegularAdmissionOffer(providerEvidence.tickets);
    expect(selected?.amountMinor).toBe(1500);
  });
});

describe('Into The Madness / VERTILE redirect identity', () => {
  it('detects provider URL reuse for a different event', () => {
    const evidence = evaluateTicketTargetIdentity({
      originalUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
      redirectChain: [
        'https://musical-madness.ticket.io/ebqBfbhC/',
        'https://musical-madness.ticket.io/xYzVert1/',
      ],
      terminalUrl: 'https://musical-madness.ticket.io/xYzVert1/',
      providerKey: 'ticket_io',
      terminalTitle: 'VERTILE',
      terminalStartAt: '2026-09-20T22:00:00+02:00',
      terminalVenue: 'Bootshaus',
      officialTitle: 'Into The Madness Pre-Party Weekender w. RAN - D and more!',
      officialStartAt: '2026-08-15T23:00:00+02:00',
      officialVenue: 'Bootshaus',
      officialTicketUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
      observedAt: '2026-08-17T12:00:00.000Z',
      contentFingerprint: 'fixture',
    });

    expect(evidence.identityDecision).toBe('redirected_to_different_event');
    expect(
      hasActivePurchaseCta({
        ticketSourceState: 'current_ticket_detail',
        identityResult: 'ticket_identity_conflict',
        identityDecision: evidence.identityDecision,
        salesStatus: 'available',
        actionKind: 'ticket_detail',
        actionLabel: 'Tickets kaufen',
        canonicalTicketUrl: evidence.terminalUrl,
        priceEvidenceState: 'verified_current',
      }),
    ).toBe(false);
  });

  it('marks ticket.io past-event redirects as stale when provider reuses the slug', () => {
    const evidence = evaluateTicketTargetIdentity({
      originalUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
      redirectChain: [
        'https://musical-madness.ticket.io/ebqBfbhC/',
        'https://musical-madness.ticket.io/eACzcM9S/?redirectFromEventInPast=1',
      ],
      terminalUrl: 'https://musical-madness.ticket.io/eACzcM9S/?redirectFromEventInPast=1',
      providerKey: 'ticket_io',
      providerEventId: 'eACzcM9S',
      terminalTitle: 'VERTILE pres. EVERYTHING CHANGES',
      terminalStartAt: '2026-09-20T22:00:00+02:00',
      terminalVenue: 'Bootshaus',
      officialTitle: 'Into The Madness Pre-Party Weekender w. RAN - D and more!',
      officialStartAt: '2026-08-15T23:00:00+02:00',
      officialVenue: 'Bootshaus',
      officialTicketUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
      observedAt: '2026-08-17T12:00:00.000Z',
      contentFingerprint: 'fixture',
    });

    expect(evidence.identityDecision).toBe('redirected_to_different_event');
    expect(evidence.reasons).toContain('provider_redirect_from_past_event');
  });
});

describe('price and CTA decoupling', () => {
  it('keeps a verified purchase CTA when no named price is exposed', () => {
    expect(
      hasActivePurchaseCta({
        ticketSourceState: 'current_ticket_detail',
        identityResult: 'ticket_identity_verified',
        identityDecision: 'verified_same_event',
        salesStatus: 'available',
        actionKind: 'ticket_detail',
        canonicalTicketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
        priceEvidenceState: 'not_yet_published',
      }),
    ).toBe(true);
  });
});
