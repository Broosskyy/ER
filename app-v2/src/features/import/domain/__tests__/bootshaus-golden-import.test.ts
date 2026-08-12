import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import {
  EMPTY_BOOTSHAUS_CONSUMER_ERROR_COUNTERS,
  extractPipeVenueFromTitle,
  mapOfficialRawToVerifiedEvidence,
  mapTicketRawToVerifiedEvidence,
  matchTicketEvidenceForOfficial,
  noopPersistBootshausGoldenImportResult,
  projectBootshausConsumerView,
  runBootshausGoldenImportPath,
  splitOfficialVenueGeography,
} from '@/features/import/domain/bootshaus-golden-import-path';
import { GOLDEN_REFERENCE_IMPORT_FIXTURES } from '@/features/import/domain/__tests__/fixtures/golden-reference-import-fixtures';
import { buildCanonicalEventFromVerifiedPublicEvidence } from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import {
  createBootshausTicketIoProductionSourceRecord,
  loadTicketIoBootshausFixtureHtml,
} from '@/features/sources/production/ticket-io-source.fixtures.server';

const VERIFIED_AT = '2026-08-12T12:00:00.000Z';
const TICKET_FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);

describe('bootshaus golden import path', () => {
  it('matches outbound ticket URLs from official connector ticketUrl', () => {
    const officialRecord = createBootshausProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(officialRecord);
    const officialRaw = {
      externalId: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      importId: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      sourceUrl: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      title: "Bootshaus pres. BC173 (let's get loco)",
      startDate: '2026-08-15T16:00:00',
      ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      eventUrl: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      rawSourceType: 'unknown' as const,
    };
    const ticketRaw = {
      externalId: 'https://bootshaus-club.ticket.io/BcDqml12/',
      importId: 'https://bootshaus-club.ticket.io/BcDqml12/',
      title: 'BC173 Airport Session pres. by Bootshaus III',
      startDate: '2026-08-15T16:00:00+02:00',
      timezone: 'Europe/Berlin',
      venueName: 'Moxy Köln/Bonn Flughafen',
      ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      rawSourceType: 'json_ld' as const,
    };

    const official = mapOfficialRawToVerifiedEvidence(officialRaw, importSource, VERIFIED_AT);
    const ticket = mapTicketRawToVerifiedEvidence(ticketRaw, VERIFIED_AT);
    const match = matchTicketEvidenceForOfficial(official!, [ticket]);

    expect(match.matchReason).toBe('official_outbound_exact');
    expect(match.ticketEvidence?.publicTicketUrl).toContain('BcDqml12');
    expect(official?.outboundTicketUrls?.some((url) => url.includes('BcDqml12'))).toBe(true);
  });

  it('splits venue geography and rejects Technodampfer-style field mixing', () => {
    const split = splitOfficialVenueGeography({
      venueName: 'Auenweg 173, 51063 Köln',
      venueCity: 'Auenweg 173, 51063 Köln',
      metadata: {},
      sourceDefaults: {
        venueName: 'Bootshaus',
        cityName: 'Köln',
        address: 'Auenweg 173',
        postalCode: '51063',
        countryCode: 'DE',
      },
    });
    expect(split.venueName).toBe('Bootshaus');
    expect(split.venueAddress).toBe('Auenweg 173');
    expect(split.venuePostalCode).toBe('51063');
    expect(split.venueCity).toBe('Köln');
  });

  it('does not apply Bootshaus defaults for offsite title locations', () => {
    const split = splitOfficialVenueGeography({
      title: '122 pres. KAZ JAMES @ Palma de Mallorca (ES)',
      metadata: {},
      sourceDefaults: {
        venueName: 'Bootshaus',
        cityName: 'Köln',
        address: 'Auenweg 173',
        postalCode: '51063',
        countryCode: 'DE',
      },
    });
    expect(split.venueCity).toBe('Palma de Mallorca');
    expect(split.countryCode).toBe('ES');
    expect(split.venueAddress).toBeUndefined();
    expect(split.venuePostalCode).toBeUndefined();
    expect(split.venueName).toBeUndefined();
  });

  it('extracts pipe-delimited offsite venue names from titles', () => {
    expect(extractPipeVenueFromTitle('SA * 22.08.2026 | KitKatClub')).toBe('KitKatClub');
    expect(extractPipeVenueFromTitle('SA * 22.08.2026\u00a0|\u00a0KitKatClub')).toBe('KitKatClub');
    const split = splitOfficialVenueGeography({
      title: 'SA * 22.08.2026 | KitKatClub',
      metadata: {},
      sourceDefaults: {
        venueName: 'Bootshaus',
        cityName: 'Köln',
        address: 'Auenweg 173',
        postalCode: '51063',
        countryCode: 'DE',
      },
    });
    expect(split.venueName).toBe('KitKatClub');
    expect(split.venueAddress).toBeUndefined();
    expect(split.venuePostalCode).toBeUndefined();
  });

  it('applies exact outbound ticket fields for offsite events without venue blocking', () => {
    const officialRecord = createBootshausProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(officialRecord);
    const officialRaw = {
      externalId: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      importId: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      sourceUrl: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      title: "Bootshaus pres. BC173 (let's get loco)",
      startDate: '2026-08-15T16:00:00',
      ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      eventUrl: 'https://bootshaus.tv/events/15-8-26-bootshaus-pres-bc173-let-s-get-loco',
      rawSourceType: 'unknown' as const,
    };
    const ticketRaw = {
      externalId: 'https://bootshaus-club.ticket.io/BcDqml12/',
      importId: 'https://bootshaus-club.ticket.io/BcDqml12/',
      title: 'BC173 Airport Session pres. by Bootshaus III',
      startDate: '2026-08-15T16:00:00+02:00',
      timezone: 'Europe/Berlin',
      venueName: 'Moxy Köln/Bonn Flughafen',
      ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      priceText: 'ab 23,00 €',
      rawSourceType: 'json_ld' as const,
      sourceMetadata: {
        ticketOffers: [{ name: 'Admission', priceAmount: 23, priceCurrency: 'EUR' }],
      },
    };

    const result = runBootshausGoldenImportPath({
      officialRawEvents: [officialRaw],
      ticketRawEvents: [ticketRaw],
      officialImportSource: importSource,
      verifiedAt: VERIFIED_AT,
    });

    expect(result.matrix).toHaveLength(1);
    const row = result.matrix[0]!;
    expect(row.ticketUrl).toContain('BcDqml12');
    expect(row.priceText).toMatch(/23/);
    expect(row.venueName).not.toBe('Bootshaus');
    expect(row.venueAddress).toBeUndefined();
    expect(row.decision).toBe('quick_review');
    expect(row.reviewReason).toBe('venue_missing');
  });

  it('keeps optional lineup gaps from blocking on-site consumer-ready events', () => {
    const officialRecord = createBootshausProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(officialRecord);
    const officialRaw = {
      externalId: 'https://bootshaus.tv/events/neonsplash-paint-rave',
      importId: 'https://bootshaus.tv/events/neonsplash-paint-rave',
      sourceUrl: 'https://bootshaus.tv/events/neonsplash-paint-rave',
      title: 'NEONSPLASH Paint-Rave',
      startDate: '2026-08-14T22:00:00',
      eventUrl: 'https://bootshaus.tv/events/neonsplash-paint-rave',
      rawSourceType: 'unknown' as const,
    };

    const result = runBootshausGoldenImportPath({
      officialRawEvents: [officialRaw],
      ticketRawEvents: [],
      officialImportSource: importSource,
      verifiedAt: VERIFIED_AT,
    });

    expect(result.matrix[0]?.decision).toBe('consumer_ready');
    expect(result.matrix[0]?.enrichmentGaps.some((gap) => gap === 'lineup' || gap === 'no_structured_lineup_or_dual_headliner_confirmation')).toBe(true);
  });

  it('reprocesses the live capture snapshot offline without production writes', () => {
    const capturePath = join(process.cwd(), '.tmp/bootshaus-live-capture.json');
    const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as {
      verifiedAt: string;
      officialEvents: Parameters<typeof runBootshausGoldenImportPath>[0]['officialRawEvents'];
      ticketEvents: Parameters<typeof runBootshausGoldenImportPath>[0]['ticketRawEvents'];
    };
    const officialRecord = createBootshausProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(officialRecord);
    const result = runBootshausGoldenImportPath({
      officialRawEvents: capture.officialEvents,
      ticketRawEvents: capture.ticketEvents,
      officialImportSource: importSource,
      verifiedAt: capture.verifiedAt,
    });
    const persistence = noopPersistBootshausGoldenImportResult(result);

    expect(result.officialEventCount).toBe(30);
    expect(persistence.productionMutationsInThisRun).toBe(0);
    expect(result.consumerErrorCounters).toEqual(EMPTY_BOOTSHAUS_CONSUMER_ERROR_COUNTERS);
  });

  it('runs fixture official and ticket events through the golden builder without consumer errors', async () => {
    const officialRecord = createBootshausProductionSourceRecord();
    const ticketRecord = createBootshausTicketIoProductionSourceRecord();
    const officialImportSource = mapSourceRecordToImportSource(officialRecord);
    const ticketImportSource = mapSourceRecordToImportSource(ticketRecord);
    const officialAggregation = mapSourceRecordToAggregationSource(officialRecord);

    const officialOutput = await websiteProcessor.process({
      url: 'https://bootshaus.tv/events/',
      importSource: officialImportSource,
      connectorKey: 'club_website',
    });

    const ticketHtml = readFileSync(TICKET_FIXTURE_PATH, 'utf8');
    const ticketRaw = await fetchTicketPlatformEvents({
      source: mapSourceRecordToAggregationSource(ticketRecord),
      importSource: ticketImportSource,
      connectorKey: 'ticket_platform',
      fixtureHtml: ticketHtml,
      observedAt: VERIFIED_AT,
    });

    const result = runBootshausGoldenImportPath({
      officialRawEvents: officialOutput.events,
      ticketRawEvents: ticketRaw,
      officialImportSource,
      verifiedAt: VERIFIED_AT,
    });
    const persistence = noopPersistBootshausGoldenImportResult(result);

    expect(result.officialEventCount).toBeGreaterThan(0);
    expect(result.ticketEventCount).toBeGreaterThan(0);
    expect(persistence.productionMutationsInThisRun).toBe(0);

    expect(result.consumerErrorCounters).toEqual(EMPTY_BOOTSHAUS_CONSUMER_ERROR_COUNTERS);

    for (const row of result.matrix.filter((entry) => entry.decision !== 'quarantine')) {
      const consumer = projectBootshausConsumerView(row);
      if (row.venueName) {
        expect(consumer.projection.venueLabel).toBeTruthy();
      }
      expect(consumer.projection.cityLabel).toBeTruthy();
      if (row.venueCity) {
        expect(consumer.projection.cityLabel).not.toMatch(/\b\d{5}\b/);
      }
    }

    expect(officialAggregation.id).toBe('source-bootshaus-koeln');
    expect(loadTicketIoBootshausFixtureHtml().length).toBeGreaterThan(0);
  });

  it('keeps golden reference fixtures on the established builder path', () => {
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
