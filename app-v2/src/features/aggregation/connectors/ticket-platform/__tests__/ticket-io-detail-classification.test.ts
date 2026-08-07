import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTicketIoShopHtml, parseTicketIoEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import {
  classifyTicketIoDetailHtml,
  partitionTicketIoAdmissionProducts,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-classification';
import { parseTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import {
  resolveTicketIoDetailFetchStatus,
  ticketIoListDetailIdentityConflict,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-card-evidence';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';

const ENRICHED_DETAIL = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-proton-shockone-detail-enriched.html',
);
const PURE_POW_DETAIL = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-proton-shockone-detail.html',
);

const GENERIC_LIST_HTML = `<table><tbody><tr><td id="event-row-hyHJr2xd" class="row">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"MusicEvent","name":"DNB CONNECTION pres. SHOCKONE","startDate":"2026-07-31T23:00:00+02:00","location":{"@type":"Place","name":"Proton The Club"},"offers":{"price":12,"priceCurrency":"EUR","url":"https://proton-the-club.ticket.io/hyHJr2xd/"},"url":"https://proton-the-club.ticket.io/hyHJr2xd/"}</script>
<ul class="fa-ul list-eventinfos"><li class="tio-overview-tickets-from"><span>Tickets from 12,00 Euro</span></li></ul>
</td></tr></tbody></table>`;

const LEVI_STYLE_DETAIL_HTML = `<!DOCTYPE html>
<html><head>
<title>Security check...</title>
<script src="https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js"></script>
</head><body>
<script type="application/ld+json">{
  "@context": "http://schema.org",
  "@type": "MusicEvent",
  "name": "LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne",
  "startDate": "2026-08-07T22:00:00+02:00",
  "location": { "@type": "Place", "name": "Bootshaus" },
  "url": "https://bootshaus-tickets.ticket.io/YvJnLSXd/",
  "offers": [
    { "@type": "Offer", "name": "Early Entry", "price": 28, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "5 Friends Ticket", "price": 30, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Phase 3", "price": 36, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "VIP", "price": 65, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Locker", "price": 4, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Locker", "price": 7, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" }
  ]
}</script>
</body></html>`;

describe('ticket.io content-aware detail classification', () => {
  it('A classifies real detail data without challenge markers as ok', () => {
    const html = readFileSync(ENRICHED_DETAIL, 'utf8');
    const classification = classifyTicketIoDetailHtml(html);
    expect(classification.detailFetchStatus).toBe('ok');
    expect(classification.hasUsableIdentity).toBe(true);
    expect(classification.identity.pageTitle).toContain('SHOCKONE');
    expect(resolveTicketIoDetailFetchStatus(html)).toBe('ok');
    expect(parseTicketIoDetailHtml(html).blockedByPow).not.toBe(true);
  });

  it('B prefers extracted content over harmless challenge markers', () => {
    const html = `${readFileSync(ENRICHED_DETAIL, 'utf8')}\n<script src="https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js"></script>`;
    const classification = classifyTicketIoDetailHtml(html);
    expect(classification.detailFetchStatus).toBe('ok');
    expect(classification.diagnostics).toContain('challenge_markers_present_content_usable');
    expect(classification.challengeMarkers.altcha).toBe(true);
    expect(parseTicketIoDetailHtml(html).ticketOffers?.length).toBeGreaterThan(0);
  });

  it('C classifies pure challenge pages as pow_challenge', () => {
    const html = readFileSync(PURE_POW_DETAIL, 'utf8');
    const classification = classifyTicketIoDetailHtml(html);
    expect(classification.detailFetchStatus).toBe('pow_challenge');
    expect(classification.hasUsableIdentity).toBe(false);
    expect(classification.diagnostics).toContain('pow_blocked:no_usable_semantic_content');
    expect(parseTicketIoDetailHtml(html).blockedByPow).toBe(true);
  });

  it('D accepts standalone detail pages with full semantic data', () => {
    const html = readFileSync(ENRICHED_DETAIL, 'utf8');
    const event = parseTicketIoEventDetailHtml(html, {
      platform: 'ticket_io',
      shopSlug: 'proton-the-club',
      timezone: 'Europe/Berlin',
    });
    expect(event?.title).toContain('SHOCKONE');
    expect(classifyTicketIoDetailHtml(html).detailFetchStatus).toBe('ok');
  });

  it('E excludes locker add-ons and keeps minimum admission price 28', () => {
    const classification = classifyTicketIoDetailHtml(LEVI_STYLE_DETAIL_HTML);
    expect(classification.detailFetchStatus).toBe('ok');
    expect(classification.identity.pageTitle).toContain('LEVI');
    expect(classification.identity.eventDate).toContain('2026-08-07');
    expect(classification.identity.venueName).toBe('Bootshaus');
    expect(classification.excludedProducts.map((entry) => entry.name)).toEqual(['Locker', 'Locker']);
    expect(classification.admissionProducts.map((entry) => entry.name)).toEqual([
      'Early Entry',
      '5 Friends Ticket',
      'Phase 3',
      'VIP',
    ]);

    const parsed = parseTicketIoDetailHtml(LEVI_STYLE_DETAIL_HTML);
    expect(parsed.priceAmount).toBe(28);
    expect(parsed.ticketOffers?.every((offer) => !/locker/i.test(offer.name))).toBe(true);
  });

  it('F blocks identity when detail title conflicts with list-card identity', () => {
    expect(
      ticketIoListDetailIdentityConflict(
        'Completely Different Event',
        'DNB CONNECTION pres. SHOCKONE',
        '2026-07-31T23:00:00+02:00',
        'Proton The Club',
      ),
    ).toBe(true);

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-conflict',
        title: 'DNB CONNECTION pres. SHOCKONE',
        description: 'Desc',
        startDate: '2026-07-31T23:00:00+02:00',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: 'Proton The Club',
        priceText: 'ab 18,00 €',
        ticketUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
      },
      candidate: {
        externalId: 'https://proton-the-club.ticket.io/hyHJr2xd/',
        sourceId: 'audit',
        sourceName: 'audit',
        title: 'DNB CONNECTION pres. SHOCKONE',
        startDate: '2026-07-31T23:00:00+02:00',
        venueName: 'Proton The Club',
        ticketUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
        priceText: 'ab 12,00 €',
        rawSourceType: 'html',
        sourceMetadata: {
          pageTitle: 'Completely Different Event',
          eventDate: '2026-07-31T23:00:00+02:00',
          venueName: 'Proton The Club',
          verifiedAt: '2026-08-07T10:00:00.000Z',
          publicTicketPageUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
        },
      },
      fillOnly: false,
    });

    expect(['mismatch', 'partial_review_only', 'unverifiable']).toContain(write.audit.identityVerdict);
    expect(write.audit.blockedCriticalFields).toContain('priceText');
  });

  it('G blocks freshness write when verifiedAt is missing', () => {
    const html = readFileSync(ENRICHED_DETAIL, 'utf8');
    const parsed = parseTicketIoShopHtml(
      GENERIC_LIST_HTML,
      { platform: 'ticket_io', shopSlug: 'proton-the-club', timezone: 'Europe/Berlin' },
      { hyHJr2xd: html },
    );
    const event = parsed.events.find((entry) => entry.title.includes('SHOCKONE'));
    expect(event).toBeTruthy();

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-shockone',
        title: event!.title,
        description: 'Desc',
        startDate: event!.startDate,
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: event!.venueName,
        priceText: 'ab 18,00 €',
        ticketUrl: event!.ticketUrl,
      },
      candidate: {
        externalId: event!.externalId,
        sourceId: 'audit',
        sourceName: 'audit',
        title: event!.title,
        startDate: event!.startDate,
        venueName: event!.venueName,
        ticketUrl: event!.ticketUrl,
        priceText: event!.priceText,
        rawSourceType: 'html',
        sourceMetadata: {
          pageTitle: event!.title,
          listRowTitle: event!.title,
          eventDate: event!.startDate,
          venueName: event!.venueName,
          publicTicketPageUrl: event!.ticketUrl,
          existingVerifiedAt: '2026-01-15T10:00:00.000Z',
          ticketOffers: event!.ticketOffers,
        },
      },
      fillOnly: true,
    });

    expect(write.patch.priceText).toBeUndefined();
    expect(write.audit.freshnessFallbackRule).toBe('existing_untimestamped_not_preferred');
  });

  it('H blocks writes when list-card and detail identity diverge', () => {
    const detailHtml = readFileSync(ENRICHED_DETAIL, 'utf8').replace(
      /DNB CONNECTION pres\. SHOCKONE/g,
      'Different Event On Detail Page',
    );
    const classification = classifyTicketIoDetailHtml(detailHtml);
    expect(classification.detailFetchStatus).toBe('ok');
    expect(
      ticketIoListDetailIdentityConflict(
        classification.identity.pageTitle,
        'DNB CONNECTION pres. SHOCKONE',
        '2026-07-31T23:00:00+02:00',
        'Proton The Club',
      ),
    ).toBe(true);

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-shockone',
        title: 'DNB CONNECTION pres. SHOCKONE',
        description: 'Desc',
        startDate: '2026-07-31T23:00:00+02:00',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: 'Proton The Club',
        priceText: 'ab 18,00 €',
        ticketUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
      },
      candidate: {
        externalId: 'https://proton-the-club.ticket.io/hyHJr2xd/',
        sourceId: 'audit',
        sourceName: 'audit',
        title: 'DNB CONNECTION pres. SHOCKONE',
        startDate: '2026-07-31T23:00:00+02:00',
        venueName: 'Proton The Club',
        ticketUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
        priceText: 'ab 12,00 €',
        rawSourceType: 'html',
        sourceMetadata: {
          eventDate: '2026-07-31T23:00:00+02:00',
          venueName: 'Proton The Club',
          verifiedAt: '2026-08-07T10:00:00.000Z',
          publicTicketPageUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
          identityEvidenceConflict: true,
          ticketOffers: parseTicketIoDetailHtml(detailHtml).ticketOffers,
        },
      },
      fillOnly: false,
    });

    expect(['mismatch', 'partial_review_only', 'unverifiable']).toContain(write.audit.identityVerdict);
    expect(write.audit.blockedCriticalFields).toContain('priceText');
    expect(write.patch.priceText).toBeUndefined();
  });

  it('partitions admission products generically', () => {
    const { admissionProducts, excludedProducts } = partitionTicketIoAdmissionProducts([
      { name: 'Early Entry', priceAmount: 28, priceCurrency: 'EUR' },
      { name: 'Locker Rental', priceAmount: 4, priceCurrency: 'EUR' },
    ]);
    expect(admissionProducts).toHaveLength(1);
    expect(excludedProducts[0]?.name).toBe('Locker Rental');
  });
});
