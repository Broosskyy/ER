import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { parseTicketKingsEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { buildTicketPlatformEvidenceMetadata } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-evidence-metadata';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { mergeImportPublishFields } from '@/features/import/services/import-event-field-mapper';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import {
  evaluatePublicIdentityMatch,
  normalizeExtractedTicketPlatformPageTitle,
} from '@/features/import/ticket-platform-identity/identity-match';

const FIXTURE_OBSERVED_AT = '2026-02-01T12:00:00.000Z';
const TICKET_IO_DETAIL = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-proton-shockone-detail-enriched.html',
);
const TICKET_IO_POW_DETAIL = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-proton-shockone-detail.html',
);
const TICKET_KINGS_DETAIL = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-event-detail.html',
);
const TICKET_KINGS_CHECKOUT = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-admission-flex-checkout.html',
);

const GENERIC_TICKET_IO_LIST_HTML = `<table><tbody><tr><td id="event-row-hyHJr2xd" class="row">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"MusicEvent","name":"DNB CONNECTION pres. SHOCKONE","description":"N/A","startDate":"2026-07-31T23:00:00+02:00","location":{"@type":"Place","name":"Proton The Club","address":{"addressLocality":"Stuttgart"}},"offers":{"price":12,"priceCurrency":"EUR","url":"https://proton-the-club.ticket.io/hyHJr2xd/"},"performer":{"name":"Unbekannt"},"url":"https://proton-the-club.ticket.io/hyHJr2xd/"}</script>
<ul class="fa-ul list-eventinfos"><li class="tio-overview-tickets-from"><span>Tickets from 12,00 Euro</span></li></ul>
</td></tr></tbody></table>`;

const TICKET_IO_TWO_CARD_LIST_HTML = `<table><tbody>
<tr><td id="event-row-hyHJr2xd" class="row">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"MusicEvent","name":"DNB CONNECTION pres. SHOCKONE","startDate":"2026-07-31T23:00:00+02:00","location":{"@type":"Place","name":"Proton The Club"},"offers":{"price":12,"priceCurrency":"EUR","url":"https://proton-the-club.ticket.io/hyHJr2xd/"},"url":"https://proton-the-club.ticket.io/hyHJr2xd/"}</script>
<ul class="fa-ul list-eventinfos"><li class="tio-overview-tickets-from"><span>Tickets from 12,00 Euro</span></li></ul>
</td></tr>
<tr><td id="event-row-othrEv99" class="row">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"MusicEvent","name":"Unrelated Warehouse Night","startDate":"2026-08-15T23:00:00+02:00","location":{"@type":"Place","name":"Other Venue"},"offers":{"price":99,"priceCurrency":"EUR","url":"https://proton-the-club.ticket.io/othrEv99/"},"url":"https://proton-the-club.ticket.io/othrEv99/"}</script>
<ul class="fa-ul list-eventinfos"><li class="tio-overview-tickets-from"><span>Tickets from 99,00 Euro</span></li></ul>
</td></tr>
</tbody></table>`;

const TICKET_IO_LIST_NO_PRICE_HTML = `<table><tbody><tr><td id="event-row-hyHJr2xd" class="row">
<script type="application/ld+json">{"@context":"http://schema.org","@type":"MusicEvent","name":"DNB CONNECTION pres. SHOCKONE","startDate":"2026-07-31T23:00:00+02:00","location":{"@type":"Place","name":"Proton The Club"},"offers":{"url":"https://proton-the-club.ticket.io/hyHJr2xd/"},"url":"https://proton-the-club.ticket.io/hyHJr2xd/"}</script>
<ul class="fa-ul list-eventinfos"><li class="tio-overview-tickets-from"><span>Tickets available soon</span></li></ul>
</td></tr></tbody></table>`;

function shockoneExistingEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-shockone',
    title: 'DNB CONNECTION pres. SHOCKONE',
    description: 'Official description',
    startDate: '2026-07-31T23:00:00+02:00',
    venueName: 'Proton The Club',
    venueCity: 'Stuttgart',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function genericExistingEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-river-night',
    title: 'River Night Open Air',
    description: 'Existing description',
    startDate: '2026-09-12T20:00:00+02:00',
    venueName: 'Riverside Arena',
    venueCity: 'Köln',
    priceText: 'ab 18,00 €',
    ticketUrl: 'https://example-tickets.example/event/river-night/',
    ticketStatus: 'on_sale',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ticket platform evidence flow', () => {
  it('A keeps public event page as CTA and routes checkout embed separately', () => {
    const detailHtml = readFileSync(TICKET_KINGS_DETAIL, 'utf8');
    const checkoutHtml = readFileSync(TICKET_KINGS_CHECKOUT, 'utf8');
    const parsed = parseTicketKingsEventDetailHtml(detailHtml, {
      platform: 'ticket_king',
      shopSlug: 'ticketkings',
      timezone: 'Europe/Berlin',
    });
    expect(parsed).toBeTruthy();

    const checkoutUrl = extractNativeEventCheckoutUrl(detailHtml);
    expect(checkoutUrl).toMatch(/nacht-manager\.de\/ticketing\/native_event\.php/);

    const metadata = buildTicketPlatformEvidenceMetadata({
      event: parsed!,
      connectorKey: 'ticket_platform',
      platform: 'ticket_king',
      shopSlug: 'ticketkings',
      observedAt: FIXTURE_OBSERVED_AT,
      verifiedAt: FIXTURE_OBSERVED_AT,
      detailHtml,
      checkoutUrl,
    });

    expect(metadata.publicTicketPageUrl).toBe(parsed!.ticketUrl);
    expect(metadata.checkoutEvidenceUrl).toMatch(/nacht-manager\.de/);
    expect(metadata.checkoutEvidenceUrl).not.toBe(metadata.publicTicketPageUrl);
    expect(metadata.pageTitle).toBeTruthy();
    expect(metadata.verifiedAt).toBe(FIXTURE_OBSERVED_AT);

    const write = writeCanonicalTicketFields({
      existing: null,
      candidate: {
        externalId: parsed!.externalId,
        sourceId: 'source-generic-ticket-kings',
        sourceName: 'Generic Ticket Kings',
        title: parsed!.title,
        startDate: parsed!.startDate,
        venueName: parsed!.venueName,
        ticketUrl: parsed!.ticketUrl,
        priceText: parsed!.priceText,
        rawSourceType: 'html',
        sourceMetadata: {
          ...metadata,
          ticketOffers: parseTicketKingsCheckoutHtml(checkoutHtml).releases.map((release, index) => ({
            name: release.name,
            priceAmount: release.priceAmount,
            priceCurrency: release.priceCurrency,
            soldOut: release.soldOut,
            sortOrder: index,
          })),
          soldOut: false,
        },
      },
      fillOnly: false,
    });

    expect(write.audit.blockedCriticalFields).toEqual([]);
    expect(write.patch.ticketUrl).toBe(parsed!.ticketUrl);
    expect(write.patch.ticketUrl).not.toMatch(/nacht-manager\.de/);
  });

  it('B transports ticket.io page identity and admission snapshot to the writer', () => {
    const detailHtml = readFileSync(TICKET_IO_DETAIL, 'utf8');
    const parsed = parseTicketIoShopHtml(
      GENERIC_TICKET_IO_LIST_HTML,
      { platform: 'ticket_io', shopSlug: 'proton-the-club', timezone: 'Europe/Berlin' },
      { hyHJr2xd: detailHtml },
    );
    const event = parsed.events.find((entry) => entry.title.includes('SHOCKONE'));
    expect(event).toBeTruthy();

    const metadata = buildTicketPlatformEvidenceMetadata({
      event: event!,
      connectorKey: 'ticket_platform',
      platform: 'ticket_io',
      shopSlug: 'proton-the-club',
      observedAt: FIXTURE_OBSERVED_AT,
      verifiedAt: FIXTURE_OBSERVED_AT,
      detailHtml,
      listRowTitle: event!.title,
    });

    expect(metadata.pageTitle).toContain('SHOCKONE');
    expect(metadata.eventDate).toBe(event!.startDate);
    expect(metadata.venueName).toBeTruthy();
    expect(metadata.publicTicketPageUrl).toMatch(/ticket\.io/);

    const write = writeCanonicalTicketFields({
      existing: null,
      candidate: {
        externalId: event!.externalId,
        sourceId: 'source-generic-ticket-io',
        sourceName: 'Generic Ticket.io',
        title: event!.title,
        startDate: event!.startDate,
        venueName: event!.venueName,
        ticketUrl: event!.ticketUrl,
        priceText: event!.priceText,
        rawSourceType: 'html',
        sourceMetadata: {
          ...metadata,
          ticketOffers: event!.ticketOffers,
          soldOut: event!.soldOut ?? false,
        },
      },
      fillOnly: false,
    });

    expect(write.audit.blockedCriticalFields).toEqual([]);
    expect(write.patch.ticketUrl).toMatch(/ticket\.io/);
    expect(write.patch.priceText).toBeTruthy();
  });

  it('C blocks critical fields without page identity and preserves existing ticket data', () => {
    const existing = genericExistingEvent();
    const candidate: CanonicalImportEvent = {
      externalId: 'ext-slug-only',
      sourceId: 'source-generic-ticket-io',
      sourceName: 'Generic Ticket.io',
      title: 'River Night Open Air',
      startDate: existing.startDate,
      venueName: existing.venueName,
      cityName: existing.venueCity,
      ticketUrl: 'https://example-tickets.example/event/river-night/',
      priceText: '',
      rawSourceType: 'html',
      sourceMetadata: {
        soldOut: false,
        ticketOffers: [],
      },
    };

    const merged = mergeImportPublishFields({
      existing,
      candidate,
      fillOnly: true,
    });

    expect(merged.ticketUrl).toBe(existing.ticketUrl);
    expect(merged.priceText).toBe(existing.priceText);
    expect(merged.ticketStatus).toBe(existing.ticketStatus);
  });

  it('D excludes add-on products from admission minimum price and phases', () => {
    const checkoutHtml = readFileSync(TICKET_KINGS_CHECKOUT, 'utf8');
    const evidence = parseTicketKingsCheckoutHtml(checkoutHtml);

    expect(evidence.priceAmount).toBe(15);
    expect(evidence.excludedProducts.some((product) => /flex/i.test(product.rawProductName))).toBe(true);

    const write = writeCanonicalTicketFields({
      existing: genericExistingEvent({
        title: 'Harbor Lights Festival',
        startDate: '2026-09-12T20:00:00+02:00',
        priceText: 'ab 2,50 €',
        ticketPhases: [],
      }),
      candidate: {
        externalId: 'ext-admission-only',
        sourceId: 'source-generic-ticket-kings',
        sourceName: 'Generic Ticket Kings',
        title: 'Harbor Lights Festival',
        startDate: '2026-09-12T20:00:00+02:00',
        venueName: 'Riverside Arena',
        ticketUrl: 'https://example-tickets.example/event/harbor-lights/',
        priceText: evidence.priceText,
        rawSourceType: 'html',
        sourceMetadata: {
          pageTitle: 'Harbor Lights Festival',
          listRowTitle: 'Harbor Lights Festival',
          eventDate: '2026-09-12T20:00:00+02:00',
          venueName: 'Riverside Arena',
          verifiedAt: FIXTURE_OBSERVED_AT,
          publicTicketPageUrl: 'https://example-tickets.example/event/harbor-lights/',
          ticketOffers: evidence.releases.map((release, index) => ({
            name: release.name,
            priceAmount: release.priceAmount,
            priceCurrency: release.priceCurrency,
            soldOut: release.soldOut,
            sortOrder: index,
          })),
          soldOut: evidence.soldOut ?? false,
        },
      },
      fillOnly: false,
      manualLocks: new Set(['ticketUrl', 'websiteUrl']),
    });

    expect(write.patch.priceText).toBe('ab 15,00 €');
    expect(write.patch.ticketPhases?.every((phase) => !/flex/i.test(phase.name))).toBe(true);
    expect(write.patch.ticketPhases?.[0]?.priceAmount).toBe(15);
  });

  it('E preserves existing admission snapshot when identity passes but verifiedAt is missing', () => {
    const existing = genericExistingEvent({
      title: 'Harbor Lights Festival',
      startDate: '2026-09-12T20:00:00+02:00',
      priceText: 'ab 18,00 €',
      ticketStatus: 'on_sale',
      ticketPhases: [
        {
          id: 'phase-existing',
          name: 'Standard',
          kind: 'regular',
          sortOrder: 400,
          priceAmount: 18,
          priceCurrency: 'EUR',
        },
      ],
    });
    const checkoutHtml = readFileSync(TICKET_KINGS_CHECKOUT, 'utf8');
    const evidence = parseTicketKingsCheckoutHtml(checkoutHtml);

    const write = writeCanonicalTicketFields({
      existing,
      candidate: {
        externalId: 'ext-freshness-blocked',
        sourceId: 'source-generic-ticket-kings',
        sourceName: 'Generic Ticket Kings',
        title: 'Harbor Lights Festival',
        startDate: existing.startDate,
        venueName: existing.venueName,
        ticketUrl: 'https://example-tickets.example/event/harbor-lights/',
        priceText: evidence.priceText,
        rawSourceType: 'html',
        sourceMetadata: {
          pageTitle: 'Harbor Lights Festival',
          listRowTitle: 'Harbor Lights Festival',
          eventDate: existing.startDate,
          venueName: existing.venueName,
          publicTicketPageUrl: 'https://example-tickets.example/event/harbor-lights/',
          existingVerifiedAt: '2026-01-15T10:00:00.000Z',
          ticketOffers: evidence.releases.map((release, index) => ({
            name: release.name,
            priceAmount: release.priceAmount,
            priceCurrency: release.priceCurrency,
            soldOut: release.soldOut,
            sortOrder: index,
          })),
          soldOut: evidence.soldOut ?? false,
        },
      },
      fillOnly: true,
      now: '2099-01-01T00:00:00.000Z',
    });

    expect(write.audit.identityVerdict).toBe('exact');
    expect(write.audit.freshnessFallbackRule).toBe('existing_untimestamped_not_preferred');
    expect(write.audit.blockedCriticalFields).toEqual([]);
    expect(write.patch.priceText).toBeUndefined();
    expect(write.patch.ticketPhases).toBeUndefined();
    expect(write.fieldChanges).not.toContain('priceText');
    expect(write.fieldChanges).not.toContain('ticketPhases');
    expect(write.snapshot.ticketPhases?.[0]?.priceAmount).toBe(18);
    expect(write.snapshot.priceText).toMatch(/18/);
  });

  it('fetch attaches evidence metadata from fixtures without live requests', async () => {
    const detailHtml = readFileSync(TICKET_IO_DETAIL, 'utf8');

    const rawEvents = await fetchTicketPlatformEvents({
      source: {
        id: 'source-fixture',
        name: 'Fixture Source',
        type: 'ticket_platform',
        url: 'https://example.invalid',
        enabled: true,
      },
      importSource: {
        id: 'source-fixture',
        name: 'Fixture Source',
        type: 'ticket_platform',
        sourceConfig: {
          ticketPlatform: {
            platform: 'ticket_io',
            shopSlug: 'proton-the-club',
            timezone: 'Europe/Berlin',
          },
        },
      } as never,
      connectorKey: 'ticket_platform',
      fixtureHtml: GENERIC_TICKET_IO_LIST_HTML,
      fixtureDetailHtmlBySlug: { hyHJr2xd: detailHtml },
      observedAt: FIXTURE_OBSERVED_AT,
    });

    const withDetail = rawEvents.find((event) => event.title.includes('SHOCKONE'));
    expect(withDetail?.sourceMetadata?.pageTitle).toContain('SHOCKONE');
    expect(withDetail?.sourceMetadata?.verifiedAt).toBe(FIXTURE_OBSERVED_AT);
    expect(withDetail?.sourceMetadata?.publicTicketPageUrl).toMatch(/ticket\.io/);
  });

  describe('ticket kings extracted identity normalization', () => {
    const eventSnapshot = {
      eventId: 'evt-alpha',
      title: 'Event Alpha',
      startDate: '2026-09-01T20:00:00+02:00',
      venueName: 'Essigfabrik',
    };

    it('A strips TicketKings shop chrome and matches the canonical event title', () => {
      const rawTitle = 'Event Alpha - TicketKings - Your Ticket Kingdom';
      expect(normalizeExtractedTicketPlatformPageTitle(rawTitle)).toBe('Event Alpha');

      const metadata = buildTicketPlatformEvidenceMetadata({
        event: {
          externalId: 'tk-alpha',
          title: 'Event Alpha',
          startDate: eventSnapshot.startDate,
          venueName: eventSnapshot.venueName,
          ticketUrl: 'https://ticketkings.de/event/event-alpha/',
        },
        connectorKey: 'ticket_platform',
        platform: 'ticket_king',
        shopSlug: 'ticketkings',
        observedAt: FIXTURE_OBSERVED_AT,
        detailHtml: `<html><head><meta property="og:title" content="${rawTitle}" /></head></html>`,
      });

      expect(metadata.pageTitle).toBe('Event Alpha');
      expect(metadata.pageTitleRaw).toBe(rawTitle);

      const gate = evaluateEventEvidenceIdentityGate({
        event: eventSnapshot,
        evidence: {
          pageTitle: metadata.pageTitle as string,
          eventDate: eventSnapshot.startDate,
          venueName: eventSnapshot.venueName,
        },
        evidenceUrl: 'https://ticketkings.de/event/event-alpha/',
      });
      expect(gate.verdict).toBe('exact');
      expect(gate.criticalFieldsPublishAllowed).toBe(true);
    });

    it('B keeps mismatch when only the shop suffix matches', () => {
      const gate = evaluateEventEvidenceIdentityGate({
        event: eventSnapshot,
        evidence: {
          pageTitle: normalizeExtractedTicketPlatformPageTitle(
            'Wrong Event Name - TicketKings - Your Ticket Kingdom',
          ),
          eventDate: eventSnapshot.startDate,
          venueName: eventSnapshot.venueName,
        },
        evidenceUrl: 'https://ticketkings.de/event/wrong-event/',
      });
      expect(gate.verdict).toBe('mismatch');
      expect(gate.criticalFieldsPublishAllowed).toBe(false);
    });

    it('C blocks critical fields when only candidate.title would match but extracted page identity is wrong', () => {
      const write = writeCanonicalTicketFields({
        existing: {
          ...genericExistingEvent(),
          title: 'Event Alpha',
          startDate: eventSnapshot.startDate,
          venueName: eventSnapshot.venueName,
        },
        candidate: {
          externalId: 'tk-alpha',
          sourceId: 'source-tk',
          sourceName: 'Ticket Kings',
          title: 'Event Alpha',
          startDate: eventSnapshot.startDate,
          venueName: eventSnapshot.venueName,
          ticketUrl: 'https://ticketkings.de/event/event-alpha/',
          priceText: 'ab 15,00 €',
          rawSourceType: 'html',
          sourceMetadata: {
            pageTitle: 'Completely Different Event',
            eventDate: eventSnapshot.startDate,
            venueName: eventSnapshot.venueName,
            verifiedAt: FIXTURE_OBSERVED_AT,
            publicCtaCandidateUrl: 'https://ticketkings.de/event/event-alpha/',
          },
        },
        fillOnly: false,
      });

      expect(write.audit.identityVerdict).toBe('mismatch');
      expect(write.audit.blockedCriticalFields).toContain('priceText');
    });

    it('D accepts matching listRowTitle when pageTitle is missing', () => {
      const match = evaluatePublicIdentityMatch(eventSnapshot, {
        listRowTitle: 'Event Alpha',
        eventDate: eventSnapshot.startDate,
        venueName: eventSnapshot.venueName,
      });
      expect(match.match).toBe('exact');

      const gate = evaluateEventEvidenceIdentityGate({
        event: eventSnapshot,
        evidence: {
          listRowTitle: 'Event Alpha',
          eventDate: eventSnapshot.startDate,
          venueName: eventSnapshot.venueName,
        },
        evidenceUrl: 'https://ticketkings.de/event/event-alpha/',
      });
      expect(gate.verdict).toBe('exact');
      expect(gate.criticalFieldsPublishAllowed).toBe(true);
    });
  });

  describe('ticket.io list-card evidence fallback', () => {
    async function fetchShockoneWithFixtures(options: {
      listHtml: string;
      detailHtml?: string;
      observedAt?: string;
    }) {
      return fetchTicketPlatformEvents({
        source: {
          id: 'source-fixture',
          name: 'Fixture Source',
          type: 'ticket_platform',
          url: 'https://proton-the-club.ticket.io/',
          enabled: true,
        },
        importSource: {
          id: 'source-fixture',
          name: 'Fixture Source',
          type: 'ticket_platform',
          sourceConfig: {
            ticketPlatform: {
              platform: 'ticket_io',
              shopSlug: 'proton-the-club',
              timezone: 'Europe/Berlin',
              limits: { maxDetailPages: 1 },
            },
          },
        } as never,
        connectorKey: 'ticket_platform',
        fixtureHtml: options.listHtml,
        fixtureDetailHtmlBySlug: options.detailHtml
          ? { hyHJr2xd: options.detailHtml }
          : undefined,
        observedAt: options.observedAt ?? FIXTURE_OBSERVED_AT,
      });
    }

    it('A uses list-card identity and admission price when detail is PoW-blocked', async () => {
      const powDetail = readFileSync(TICKET_IO_POW_DETAIL, 'utf8');
      const rawEvents = await fetchShockoneWithFixtures({
        listHtml: GENERIC_TICKET_IO_LIST_HTML,
        detailHtml: powDetail,
      });
      const shockone = rawEvents.find((event) => event.title.includes('SHOCKONE'));
      expect(shockone?.sourceMetadata?.detailFetchStatus).toBe('pow_challenge');
      expect(shockone?.sourceMetadata?.evidenceRole).toBe('public_shop_list');
      expect(shockone?.sourceMetadata?.listRowTitle).toBe('DNB CONNECTION pres. SHOCKONE');
      expect(shockone?.sourceMetadata?.verifiedAt).toBe(FIXTURE_OBSERVED_AT);
      expect(shockone?.sourceMetadata?.publicTicketPageUrl).toBe(
        'https://proton-the-club.ticket.io/hyHJr2xd/',
      );

      const write = writeCanonicalTicketFields({
        existing: shockoneExistingEvent(),
        candidate: {
          externalId: shockone!.externalId,
          sourceId: 'source-ticket-io-proton',
          sourceName: 'Proton Ticket.io',
          title: shockone!.title,
          startDate: shockone!.startDate,
          venueName: shockone!.venueName,
          ticketUrl: shockone!.ticketUrl,
          priceText: shockone!.priceText,
          rawSourceType: 'json_ld',
          sourceMetadata: shockone!.sourceMetadata as Record<string, unknown>,
        },
        fillOnly: true,
      });

      expect(write.audit.identityVerdict).toBe('exact');
      expect(write.audit.blockedCriticalFields).toEqual([]);
      expect(write.patch.ticketUrl).toBe('https://proton-the-club.ticket.io/hyHJr2xd/');
      expect(write.patch.priceText).toBe('ab 12,00 €');
    });

    it('B does not invent price or phases when list card has no admission price', async () => {
      const powDetail = readFileSync(TICKET_IO_POW_DETAIL, 'utf8');
      const rawEvents = await fetchShockoneWithFixtures({
        listHtml: TICKET_IO_LIST_NO_PRICE_HTML,
        detailHtml: powDetail,
      });
      const shockone = rawEvents.find((event) => event.title.includes('SHOCKONE'));
      expect(shockone?.sourceMetadata?.ticketOffers).toBeUndefined();

      const write = writeCanonicalTicketFields({
        existing: shockoneExistingEvent({ priceText: 'ab 18,00 €' }),
        candidate: {
          externalId: shockone!.externalId,
          sourceId: 'source-ticket-io-proton',
          sourceName: 'Proton Ticket.io',
          title: shockone!.title,
          startDate: shockone!.startDate,
          venueName: shockone!.venueName,
          ticketUrl: shockone!.ticketUrl,
          rawSourceType: 'json_ld',
          sourceMetadata: shockone!.sourceMetadata as Record<string, unknown>,
        },
        fillOnly: true,
      });

      expect(write.audit.identityVerdict).toBe('exact');
      expect(write.patch.priceText).toBeUndefined();
      expect(write.patch.ticketPhases).toBeUndefined();
    });

    it('C blocks critical fields when list title does not match the canonical event', async () => {
      const powDetail = readFileSync(TICKET_IO_POW_DETAIL, 'utf8');
      const wrongTitleList = GENERIC_TICKET_IO_LIST_HTML.replace(
        'DNB CONNECTION pres. SHOCKONE',
        'Wrong Event Title On Card',
      );
      const rawEvents = await fetchShockoneWithFixtures({
        listHtml: wrongTitleList,
        detailHtml: powDetail,
      });
      const shockone = rawEvents.find((event) => event.title.includes('Wrong Event'));
      const write = writeCanonicalTicketFields({
        existing: shockoneExistingEvent(),
        candidate: {
          externalId: shockone!.externalId,
          sourceId: 'source-ticket-io-proton',
          sourceName: 'Proton Ticket.io',
          title: shockone!.title,
          startDate: shockone!.startDate,
          venueName: shockone!.venueName,
          ticketUrl: shockone!.ticketUrl,
          priceText: shockone!.priceText,
          rawSourceType: 'json_ld',
          sourceMetadata: shockone!.sourceMetadata as Record<string, unknown>,
        },
        fillOnly: true,
      });

      expect(write.audit.identityVerdict).toBe('mismatch');
      expect(write.audit.blockedCriticalFields).toContain('priceText');
      expect(write.patch.priceText).toBeUndefined();
    });

    it('D keeps title, date, venue, price, and URL bound to the same list card', async () => {
      const powDetail = readFileSync(TICKET_IO_POW_DETAIL, 'utf8');
      const rawEvents = await fetchShockoneWithFixtures({
        listHtml: TICKET_IO_TWO_CARD_LIST_HTML,
        detailHtml: powDetail,
      });
      const shockone = rawEvents.find((event) => event.title.includes('SHOCKONE'));
      const other = rawEvents.find((event) => event.title.includes('Unrelated'));

      expect(shockone?.priceText).toBe('ab 12,00 €');
      expect(shockone?.ticketUrl).toBe('https://proton-the-club.ticket.io/hyHJr2xd/');
      expect(other?.priceText).toBe('ab 99,00 €');
      expect(other?.ticketUrl).toBe('https://proton-the-club.ticket.io/othrEv99/');
      expect(shockone?.sourceMetadata?.listRowTitle).toBe('DNB CONNECTION pres. SHOCKONE');
      expect(shockone?.sourceMetadata?.eventDate).toBe('2026-07-31T23:00:00+02:00');
      expect(shockone?.sourceMetadata?.venueName).toBe('Proton The Club');
    });

    it('E skips freshness refresh when list-card evidence has no verifiedAt', async () => {
      const powDetail = readFileSync(TICKET_IO_POW_DETAIL, 'utf8');
      const rawEvents = await fetchShockoneWithFixtures({
        listHtml: GENERIC_TICKET_IO_LIST_HTML,
        detailHtml: powDetail,
      });
      const shockone = rawEvents.find((event) => event.title.includes('SHOCKONE'));
      const listCardEvidence = (shockone!.sourceMetadata as Record<string, unknown>)
        .listCardEvidence as Record<string, unknown>;
      const metadata = {
        ...(shockone!.sourceMetadata as Record<string, unknown>),
        verifiedAt: undefined,
        observedAt: undefined,
        existingVerifiedAt: '2026-01-15T10:00:00.000Z',
        listCardEvidence: {
          ...listCardEvidence,
          verifiedAt: undefined,
          observedAt: undefined,
        },
      };

      const write = writeCanonicalTicketFields({
        existing: shockoneExistingEvent({ priceText: 'ab 18,00 €' }),
        candidate: {
          externalId: shockone!.externalId,
          sourceId: 'source-ticket-io-proton',
          sourceName: 'Proton Ticket.io',
          title: shockone!.title,
          startDate: shockone!.startDate,
          venueName: shockone!.venueName,
          ticketUrl: shockone!.ticketUrl,
          priceText: shockone!.priceText,
          rawSourceType: 'json_ld',
          sourceMetadata: metadata,
        },
        fillOnly: true,
      });

      expect(write.patch.priceText).toBeUndefined();
      expect(write.audit.freshnessFallbackRule).toBe('existing_untimestamped_not_preferred');
    });

    it('F blocks writes when accessible detail identity conflicts with list-card identity', async () => {
      const conflictingDetail = `<html><head><title>Completely Different Event</title><meta property="og:title" content="Completely Different Event" /></head><body><div class="altcha">challenge</div></body></html>`;
      const rawEvents = await fetchShockoneWithFixtures({
        listHtml: GENERIC_TICKET_IO_LIST_HTML,
        detailHtml: conflictingDetail.replace('altcha', 'x-waitio-location: pow'),
      });

      const shockone = rawEvents.find((event) => event.title.includes('SHOCKONE'));
      expect(shockone?.sourceMetadata?.detailFetchStatus).toBe('pow_challenge');

      const accessibleConflictDetail = readFileSync(TICKET_IO_DETAIL, 'utf8').replace(
        'DNB CONNECTION pres. SHOCKONE',
        'Completely Different Event',
      );
      const conflictEvents = await fetchShockoneWithFixtures({
        listHtml: GENERIC_TICKET_IO_LIST_HTML,
        detailHtml: accessibleConflictDetail,
      });
      const conflictEvent = conflictEvents.find((event) => event.title.includes('SHOCKONE'));
      expect(conflictEvent?.sourceMetadata?.identityEvidenceConflict).toBe(true);
      expect(conflictEvent?.sourceMetadata?.listRowTitle).toBeUndefined();

      const write = writeCanonicalTicketFields({
        existing: shockoneExistingEvent(),
        candidate: {
          externalId: conflictEvent!.externalId,
          sourceId: 'source-ticket-io-proton',
          sourceName: 'Proton Ticket.io',
          title: conflictEvent!.title,
          startDate: conflictEvent!.startDate,
          venueName: conflictEvent!.venueName,
          ticketUrl: conflictEvent!.ticketUrl,
          priceText: conflictEvent!.priceText,
          rawSourceType: 'json_ld',
          sourceMetadata: conflictEvent!.sourceMetadata as Record<string, unknown>,
        },
        fillOnly: true,
      });

      expect(['mismatch', 'partial_review_only']).toContain(write.audit.identityVerdict);
      expect(write.audit.blockedCriticalFields).toContain('priceText');
      expect(write.patch.priceText).toBeUndefined();
    });
  });
});
