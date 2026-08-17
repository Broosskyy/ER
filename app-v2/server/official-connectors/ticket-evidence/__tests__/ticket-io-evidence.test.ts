import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTicketIoPage } from '../parse-ticket-io-page';
import { parseTicketIoShopListHtml } from '../parse-ticket-io-shop-list';
import { normalizeTicketPriceLine } from '../normalize-ticket-price';
import { normalizeTicketStatusFromText } from '../normalize-ticket-status';
import { projectTicketStatusBadge } from '../ticket-status-badge';
import { isTicketProviderBlockedBody } from '../safe-fetch-ticket';
import {
  canonicalizeTicketIoUrl,
  extractTicketIoProviderEventId,
  isCheckoutOrSessionTicketUrl,
  isTicketIoEventDetailUrl,
  isTicketIoShopRootUrl,
} from '../url-policy';

const FIXTURE_DIR = join(__dirname, 'fixtures');

describe('ticket url policy', () => {
  it('accepts canonical event detail urls', () => {
    const url = 'https://bootshaus-club.ticket.io/tA3dBrv7/?utm_source=test';
    expect(canonicalizeTicketIoUrl(url)).toBe('https://bootshaus-club.ticket.io/tA3dBrv7/');
    expect(isTicketIoEventDetailUrl(url)).toBe(true);
    expect(extractTicketIoProviderEventId(url)).toBe('tA3dBrv7');
  });

  it('rejects shop root and checkout urls', () => {
    expect(isTicketIoShopRootUrl('https://bootshaus-club.ticket.io/')).toBe(true);
    expect(isTicketIoEventDetailUrl('https://bootshaus-club.ticket.io/')).toBe(false);
    expect(isCheckoutOrSessionTicketUrl('https://bootshaus-club.ticket.io/checkout/abc')).toBe(true);
  });
});

describe('ticket status normalization', () => {
  it('maps explicit sold out without inferring from fetch failures', () => {
    expect(normalizeTicketStatusFromText('Tickets sold out').status).toBe('sold_out');
    expect(normalizeTicketStatusFromText('').status).toBe('unavailable_unknown');
  });
});

describe('ticket price normalization', () => {
  it('parses german minimum prices into minor units', () => {
    const parsed = normalizeTicketPriceLine('ab 19,90 € + Gebühr');
    expect(parsed.amountMinor).toBe(1990);
    expect(parsed.currency).toBe('EUR');
    expect(parsed.isMinimumPrice).toBe(true);
    expect(parsed.feeNotice).toContain('Gebühr');
  });
});

describe('ticket.io parser', () => {
  it('parses available offers and rejects sold out tiers', () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-available.html'), 'utf8');
    const evidence = parseTicketIoPage({
      sourceUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      body: html,
      fingerprint: 'fixture',
      observedAt: '2026-08-15T12:00:00.000Z',
      extractedAt: '2026-08-15T12:00:01.000Z',
    });
    expect(evidence?.normalizedStatus).toBe('available');
    expect(evidence?.offers.filter((o) => o.availability === 'available')).toHaveLength(1);
    expect(evidence?.offers.find((o) => o.availability === 'available')?.amountMinor).toBe(1990);
    expect(evidence?.rejectedOffers.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ticket provider blocked detection', () => {
  it('detects altcha security pages as blocked', () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-blocked.html'), 'utf8');
    expect(isTicketProviderBlockedBody(html, 'text/html')).toBe(true);
  });
});

describe('ticket.io shop list parser', () => {
  it('parses JSON-LD list cards into provider event evidence', () => {
    const html = `<!DOCTYPE html><html><body>
      <script type="application/ld+json">{
        "@type":"MusicEvent",
        "name":"Bootshaus & Loonyland pres. NYE 2026",
        "offers":{
          "@type":"Offer",
          "price":29,
          "priceCurrency":"EUR",
          "availability":"https://schema.org/InStock",
          "url":"https://bootshaus-club.ticket.io/S0cbXDda/"
        }
      }</script>
    </body></html>`;
    const parsed = parseTicketIoShopListHtml('https://bootshaus-club.ticket.io/', html);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.providerEventId).toBe('S0cbXDda');
    expect(parsed.entries[0]?.amountMinor).toBe(2900);
    expect(parsed.entries[0]?.ticketStatus).toBe('available');
    expect(projectTicketStatusBadge('available')).toBe('Tickets verfügbar');
  });
});

describe('ticket offer roles', () => {
  it('classifies lockers as non-admission offers', async () => {
    const { classifyTicketOfferRole, isAdmissionOfferRole } = await import('../ticket-offer-role');
    expect(classifyTicketOfferRole('Locker large')).toBe('locker');
    expect(isAdmissionOfferRole('locker')).toBe(false);
  });
});

describe('cached response classification', () => {
  it('detects security challenge only pages', async () => {
    const { classifyCachedTicketIoResponse } = await import('../parse-ticket-io-detail-dom');
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-blocked.html'), 'utf8');
    expect(classifyCachedTicketIoResponse(html)).toBe('security_challenge_only');
  });
});
