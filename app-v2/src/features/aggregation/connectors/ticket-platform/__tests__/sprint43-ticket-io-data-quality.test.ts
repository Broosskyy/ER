import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { formatGermanTicketPrice } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { parseTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import {
  isTicketIoPlaceholderDescription,
  sanitizeTicketIoDescription,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import { parseTicketIoListRowContexts } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import {
  ticketIoEventUrlsEquivalent,
  validateTicketIoEventUrl,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { EventNormalizer } from '@/features/import/normalization/event-normalizer';

const BOOTSHAUS_FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);
const SHOCKONE_DETAIL_FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-proton-shockone-detail-enriched.html',
);

describe('ticket.io field quality', () => {
  it('strips placeholder descriptions and artists', () => {
    expect(isTicketIoPlaceholderDescription('N/A')).toBe(true);
    expect(sanitizeTicketIoDescription('N/A')).toBeUndefined();
    expect(extractArtistsFromEventTitle('DNB CONNECTION pres. SHOCKONE')).toEqual(['SHOCKONE']);
  });

  it('parses list row price overview text', () => {
    const html = readFileSync(BOOTSHAUS_FIXTURE, 'utf8');
    const contexts = parseTicketIoListRowContexts(html);
    const first = [...contexts.values()][0];
    expect(first?.priceText).toMatch(/ab/i);
    expect(first?.priceOverviewText).toMatch(/15,00 Euro/i);
  });

  it('parses SHOCKONE detail lineup and offers from fixture', () => {
    const html = readFileSync(SHOCKONE_DETAIL_FIXTURE, 'utf8');
    const detail = parseTicketIoDetailHtml(html, 'DNB CONNECTION pres. SHOCKONE');
    expect(detail.artistNames).toEqual([
      'SHOCKONE',
      'T!mb',
      'Not Fair',
      'Kyuuti',
      'MC Haze',
    ]);
    expect(detail.description).toContain('DNB CONNECTION');
    expect(detail.ticketOffers?.length).toBe(2);
    expect(detail.priceText).toBe(formatGermanTicketPrice(12, 'EUR'));
  });

  it('merges list and detail enrichment for SHOCKONE', () => {
    const listHtml = `<table><tbody><tr><td id="event-row-hyHJr2xd" class="row">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"MusicEvent","name":"DNB CONNECTION pres. SHOCKONE","description":"N/A","startDate":"2026-07-31T23:00:00+02:00","location":{"@type":"Place","name":"Proton The Club","address":{"addressLocality":"Stuttgart"}},"offers":{"price":12,"priceCurrency":"EUR","url":"https://proton-the-club.ticket.io/hyHJr2xd/"},"performer":{"name":"Unbekannt"},"url":"https://proton-the-club.ticket.io/hyHJr2xd/"}</script>
<ul class="fa-ul list-eventinfos"><li class="tio-overview-tickets-from"><span>Tickets from 12,00 Euro</span></li><li><span>GENRE DRUM AND BASS</span></li></ul>
</td></tr></tbody></table>`;
    const detailHtml = readFileSync(SHOCKONE_DETAIL_FIXTURE, 'utf8');
    const result = parseTicketIoShopHtml(listHtml, {
      platform: 'ticket_io',
      shopSlug: 'proton-the-club',
      timezone: 'Europe/Berlin',
    }, { hyHJr2xd: detailHtml });

    const event = result.events.find((entry) => entry.title.includes('SHOCKONE'));
    expect(event?.description).toContain('DNB CONNECTION');
    expect(event?.artistNames).toEqual([
      'SHOCKONE',
      'T!mb',
      'Not Fair',
      'Kyuuti',
      'MC Haze',
    ]);
    expect(event?.priceText).toMatch(/12/);
    expect(event?.genreNames).toEqual(
      expect.arrayContaining([expect.stringMatching(/drum/i)]),
    );
    expect(event?.ticketUrl).toBe('https://proton-the-club.ticket.io/hyHJr2xd/');
  });

  it('validates ticket.io event URLs against shop slug and event id', () => {
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
        shopSlug: 'proton-the-club',
      }).valid,
    ).toBe(true);
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://proton-the-club.ticket.io/',
        shopSlug: 'proton-the-club',
      }).valid,
    ).toBe(false);
    expect(
      ticketIoEventUrlsEquivalent(
        'https://proton-the-club.ticket.io/hyHJr2xd',
        'https://proton-the-club.ticket.io/hyHJr2xd/',
      ),
    ).toBe(true);
  });

  it('normalizes placeholder descriptions in EventNormalizer', () => {
    const normalizer = new EventNormalizer();
    const { candidate } = normalizer.normalize({
      externalId: 'https://proton-the-club.ticket.io/hyHJr2xd/',
      title: 'DNB CONNECTION pres. SHOCKONE',
      description: 'N/A',
      startDate: '2026-07-31T23:00:00+02:00',
      rawSourceType: 'json_ld',
      priceText: 'ab 12,00 €',
    });
    expect(candidate?.description).toBeUndefined();
    expect(candidate?.priceText).toBe('ab 12,00 €');
  });
});
