import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { classifyOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';
import {
  buildListCorroboratedOfficialEvidence,
  findTicketEvidenceByPublicUrl,
  mapOfficialRawToVerifiedEvidence,
  mapTicketRawToVerifiedEvidence,
  matchTicketEvidenceForOfficial,
  runBootshausGoldenImportPath,
} from '@/features/import/domain/bootshaus-golden-import-path';
import { buildCanonicalEventFromVerifiedPublicEvidence } from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import { deriveTicketStatusFromPhases } from '@/features/import/domain/canonical-ticket-phase';
import { GOLDEN_REFERENCE_IMPORT_FIXTURES } from '@/features/import/domain/__tests__/fixtures/golden-reference-import-fixtures';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source.fixtures.server';

const VERIFIED_AT = '2026-08-12T18:00:00.000Z';
const LIST_FIXTURE = readFileSync(
  join(process.cwd(), 'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html'),
  'utf8',
);

async function loadListTicketEvents() {
  const ticketRecord = createBootshausTicketIoProductionSourceRecord();
  return fetchTicketPlatformEvents({
    source: mapSourceRecordToAggregationSource(ticketRecord),
    importSource: mapSourceRecordToImportSource(ticketRecord),
    connectorKey: 'ticket_platform',
    fixtureHtml: LIST_FIXTURE,
    observedAt: VERIFIED_AT,
  });
}

describe('bootshaus ticket.io list evidence', () => {
  it('maps ticket.io list entries as current ticket evidence with concrete event URLs', async () => {
    const events = await loadListTicketEvents();
    expect(events.length).toBeGreaterThan(0);
    const mapped = mapTicketRawToVerifiedEvidence(events[0]!, VERIFIED_AT);
    expect(mapped.publicTicketUrl).toMatch(/ticket\.io\/[A-Za-z0-9]+\/?$/);
    expect(classifyOutboundTicketLink(mapped.publicTicketUrl!).class).toBe('ticket_io_event');
    expect(mapped.listRowTitle).toBeTruthy();
    expect(mapped.verifiedAt).toBe(VERIFIED_AT);
  });

  it('treats shop root as acquisition endpoint, not event identity', () => {
    const shopRoot = classifyOutboundTicketLink('https://bootshaus-club.ticket.io/');
    expect(shopRoot.class).toBe('ticket_shop_root');
    const mapped = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/',
        importId: 'https://bootshaus-club.ticket.io/',
        title: 'Bootshaus',
        startDate: '2026-09-01T20:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/',
        rawSourceType: 'json_ld',
      },
      VERIFIED_AT,
    );
    expect(classifyOutboundTicketLink(mapped.publicTicketUrl!).class).not.toBe('ticket_io_event');
  });

  it('prefers exact outbound over fuzzy list matching', () => {
    const official = {
      pageUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
      pageTitle: 'R3HAB pres. by BOOTSHAUS',
      eventDate: '2026-09-04T22:00:00+02:00',
      outboundTicketUrls: ['https://bootshaus-club.ticket.io/C7JPnatZ/'],
      concreteTicketUrls: ['https://bootshaus-club.ticket.io/C7JPnatZ/'],
      verifiedAt: VERIFIED_AT,
    };
    const exact = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        importId: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        priceText: 'ab 26,90 €',
        rawSourceType: 'json_ld',
        sourceMetadata: {
          ticketOffers: [{ name: 'Admission', priceAmount: 26.9, priceCurrency: 'EUR' }],
        },
      },
      VERIFIED_AT,
    );
    const fuzzy = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/OTHER1/',
        importId: 'https://bootshaus-club.ticket.io/OTHER1/',
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/OTHER1/',
        rawSourceType: 'json_ld',
      },
      VERIFIED_AT,
    );
    const match = matchTicketEvidenceForOfficial(official, [fuzzy, exact]);
    expect(match.matchReason).toBe('official_outbound_exact');
    expect(match.ticketEvidence?.publicTicketUrl).toContain('C7JPnatZ');
  });

  it('matches identical concrete ticket URLs without outbound classification', () => {
    const official = {
      pageUrl: 'https://bootshaus.tv/events/example',
      pageTitle: 'Example Event',
      eventDate: '2026-09-04T22:00:00+02:00',
      concreteTicketUrls: ['https://bootshaus-club.ticket.io/C7JPnatZ/'],
      verifiedAt: VERIFIED_AT,
    };
    const ticket = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        importId: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        title: 'Example Event',
        startDate: '2026-09-04T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        priceText: 'ab 26,90 €',
        rawSourceType: 'json_ld',
        sourceMetadata: {
          ticketOffers: [{ name: 'Admission', priceAmount: 26.9, priceCurrency: 'EUR' }],
        },
      },
      VERIFIED_AT,
    );
    const match = matchTicketEvidenceForOfficial(official, [ticket]);
    expect(match.matchReason).toBe('exact_concrete_ticket_url');
  });

  it('does not let list evidence overwrite official venue or genre fields', async () => {
    const events = await loadListTicketEvents();
    const ticket = mapTicketRawToVerifiedEvidence(events[0]!, VERIFIED_AT);
    const official = {
      pageUrl: 'https://bootshaus.tv/events/neonsplash-paint-rave',
      pageTitle: 'NEONSPLASH Paint-Rave',
      eventDate: '2026-08-14T22:00:00+02:00',
      venueName: 'Bootshaus',
      venueAddress: 'Auenweg 173',
      venuePostalCode: '51063',
      venueCity: 'Köln',
      genreLabels: ['Techno'],
      verifiedAt: VERIFIED_AT,
    };
    const build = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: official,
      ticketEvidence: { ...ticket, venueName: 'Other Venue', ticketPlatformGenres: ['House'] },
    });
    expect(build.canonicalPatch.venueName).toBe('Bootshaus');
    expect(build.canonicalPatch.genreLabels).toEqual(['Techno']);
    expect(build.canonicalPatch.websiteUrl).toBe(official.pageUrl);
  });

  it('uses admission price without add-ons', () => {
    const mapped = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        importId: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        title: 'Loonyland',
        startDate: '2026-08-21T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        rawSourceType: 'json_ld',
        sourceMetadata: {
          ticketOffers: [
            { name: 'Admission', priceAmount: 25.9, priceCurrency: 'EUR' },
            { name: 'Parking', priceAmount: 5, priceCurrency: 'EUR', kind: 'addon' },
          ],
        },
      },
      VERIFIED_AT,
    );
    expect(mapped.priceText).toMatch(/25,90/);
    expect(mapped.ticketOffers?.every((offer) => offer.kind !== 'addon')).toBe(true);
  });

  it('maps on_sale idempotently from admission phases', () => {
    const raw = {
      externalId: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      importId: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      title: 'Loonyland',
      startDate: '2026-08-21T22:00:00+02:00',
      ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      rawSourceType: 'json_ld' as const,
      sourceMetadata: {
        ticketOffers: [{ name: 'Admission', priceAmount: 25.9, priceCurrency: 'EUR' }],
      },
    };
    const first = mapTicketRawToVerifiedEvidence(raw, VERIFIED_AT);
    const second = mapTicketRawToVerifiedEvidence(raw, VERIFIED_AT);
    expect(first.ticketStatus).toBe('on_sale');
    expect(second.ticketStatus).toBe('on_sale');
    expect(deriveTicketStatusFromPhases(first.ticketPhases, undefined)).toBe('on_sale');
  });

  it('returns conflict_review when multiple list candidates match', () => {
    const official = {
      pageUrl: 'https://bootshaus.tv/events/example',
      pageTitle: 'Shared Title',
      eventDate: '2026-09-04T22:00:00+02:00',
      venueName: 'Bootshaus',
      verifiedAt: VERIFIED_AT,
    };
    const ticketA = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/AAAAAA/',
        importId: 'https://bootshaus-club.ticket.io/AAAAAA/',
        title: 'Shared Title',
        startDate: '2026-09-04T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/AAAAAA/',
        rawSourceType: 'json_ld',
      },
      VERIFIED_AT,
    );
    const ticketB = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/BBBBBB/',
        importId: 'https://bootshaus-club.ticket.io/BBBBBB/',
        title: 'Shared Title',
        startDate: '2026-09-04T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/BBBBBB/',
        rawSourceType: 'json_ld',
      },
      VERIFIED_AT,
    );
    const match = matchTicketEvidenceForOfficial(official, [ticketA, ticketB]);
    expect(match.matchReason).toBe('multiple_fuzzy_ticket_matches');
    const importSource = mapSourceRecordToImportSource(createBootshausProductionSourceRecord());
    const result = runBootshausGoldenImportPath({
      officialRawEvents: [
        {
          externalId: official.pageUrl!,
          importId: official.pageUrl!,
          sourceUrl: official.pageUrl,
          title: official.pageTitle!,
          startDate: official.eventDate!,
          eventUrl: official.pageUrl,
          rawSourceType: 'unknown',
        },
      ],
      ticketRawEvents: [
        {
          externalId: ticketA.publicTicketUrl!,
          importId: ticketA.publicTicketUrl!,
          title: ticketA.listRowTitle!,
          startDate: ticketA.eventDate!,
          ticketUrl: ticketA.publicTicketUrl,
          rawSourceType: 'json_ld',
        },
        {
          externalId: ticketB.publicTicketUrl!,
          importId: ticketB.publicTicketUrl!,
          title: ticketB.listRowTitle!,
          startDate: ticketB.eventDate!,
          ticketUrl: ticketB.publicTicketUrl,
          rawSourceType: 'json_ld',
        },
      ],
      officialImportSource: importSource,
      verifiedAt: VERIFIED_AT,
    });
    expect(result.matrix[0]?.decision).toBe('conflict_review');
  });

  it('blocks ticket fields when list evidence is missing instead of guessing', () => {
    const official = {
      pageUrl: 'https://bootshaus.tv/events/only-official',
      pageTitle: 'Only Official',
      eventDate: '2026-09-04T22:00:00+02:00',
      venueName: 'Bootshaus',
      verifiedAt: VERIFIED_AT,
    };
    const build = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: official,
    });
    expect(build.canonicalPatch.ticketUrl).toBeUndefined();
    expect(build.canonicalPatch.priceText).toBeUndefined();
    expect(build.reviewReasons.some((reason) => reason.includes('ticket'))).toBe(false);
  });

  it('builds list-corroborated official evidence for ticket URL pairing', () => {
    const ticket = mapTicketRawToVerifiedEvidence(
      {
        externalId: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        importId: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        title: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        startDate: '2026-08-21T22:00:00+02:00',
        ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        priceText: 'ab 25,90 €',
        rawSourceType: 'json_ld',
        sourceMetadata: {
          ticketOffers: [{ name: 'Admission', priceAmount: 25.9, priceCurrency: 'EUR' }],
        },
      },
      VERIFIED_AT,
    );
    const official = buildListCorroboratedOfficialEvidence({
      officialPageUrl: 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie',
      ticketEvidence: ticket,
      verifiedAt: VERIFIED_AT,
    });
    const match = matchTicketEvidenceForOfficial(official, [ticket]);
    expect(findTicketEvidenceByPublicUrl([ticket], 'https://bootshaus-club.ticket.io/tA3dBrv7/')).toBe(ticket);
    expect(['official_outbound_exact', 'exact_concrete_ticket_url']).toContain(match.matchReason);
    const build = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: official,
      ticketEvidence: match.ticketEvidence,
    });
    expect(build.canonicalPatch.ticketUrl).toContain('tA3dBrv7');
    expect(build.canonicalPatch.priceText).toMatch(/25,90/);
    expect(build.canonicalPatch.websiteUrl).toBe(official.pageUrl);
  });

  it('keeps golden reference fixtures green on the builder path', () => {
    for (const fixture of GOLDEN_REFERENCE_IMPORT_FIXTURES) {
      const buildResult = buildCanonicalEventFromVerifiedPublicEvidence({
        officialEvidence: fixture.officialEvidence,
        ticketEvidence: fixture.ticketEvidence,
        checkoutEvidence: fixture.checkoutEvidence,
        conflictingTicketEvidence: fixture.conflictingTicketEvidence,
      });
      expect(buildResult.disposition).toBe(fixture.expectedDisposition);
    }
  });
});
