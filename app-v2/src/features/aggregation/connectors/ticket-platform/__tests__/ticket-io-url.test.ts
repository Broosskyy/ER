import { describe, expect, it } from 'vitest';

import {
  buildTicketIoSourceId,
  buildTicketIoStableKey,
  extractTicketIoShopSlug,
  extractTicketIoShopSlugsFromText,
  isTicketIoUrl,
  normalizeTicketIoListUrl,
  parseTicketIoUrl,
  ticketIoUrlsEquivalent,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';

describe('ticket.io URL utilities', () => {
  it('detects and normalizes ticket.io shop URLs', () => {
    expect(isTicketIoUrl('https://bootshaus-club.ticket.io/')).toBe(true);
    expect(extractTicketIoShopSlug('https://bootshaus-club.ticket.io/events')).toBe('bootshaus-club');
    expect(normalizeTicketIoListUrl('bootshaus-club.ticket.io')).toBe('https://bootshaus-club.ticket.io/');
    expect(parseTicketIoUrl('https://bootshaus-club.ticket.io/?lang=de')).toEqual({
      shopSlug: 'bootshaus-club',
      listUrl: 'https://bootshaus-club.ticket.io/',
      normalizedUrl: 'https://bootshaus-club.ticket.io/',
      externalShopId: 'bootshaus-club',
    });
  });

  it('ignores reserved ticket.io hostnames', () => {
    expect(extractTicketIoShopSlug('https://www.ticket.io/')).toBeNull();
    expect(extractTicketIoShopSlug('https://cdn.ticket.io/assets')).toBeNull();
  });

  it('extracts shop slugs from corpus text', () => {
    const slugs = extractTicketIoShopSlugsFromText(
      'See https://newclub.ticket.io/ and https://festival.ticket.io/events',
    );
    expect(slugs).toEqual(expect.arrayContaining(['newclub', 'festival']));
  });

  it('builds stable source identifiers per shop', () => {
    expect(buildTicketIoSourceId('my-club')).toBe('source-ticket-io-my-club');
    expect(buildTicketIoStableKey('my-club')).toBe('ticket-io-my-club-v1');
  });

  it('detects duplicate shop URLs', () => {
    expect(
      ticketIoUrlsEquivalent('https://club.ticket.io/', 'https://club.ticket.io/?lang=en'),
    ).toBe(true);
    expect(ticketIoUrlsEquivalent('https://club-a.ticket.io/', 'https://club-b.ticket.io/')).toBe(false);
  });
});
