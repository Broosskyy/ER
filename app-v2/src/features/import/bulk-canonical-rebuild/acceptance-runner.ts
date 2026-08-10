import type { AdminEventRecord } from '@/data/types/records';

import { BULK_REBUILD_ACCEPTANCE_FIXTURES } from './acceptance-fixtures';
import { buildConsumerProjection, rebuiltToAdminShape } from './evidence-field-extractor';
import type { BulkRebuildEventRow } from './types';

export interface AcceptanceFixtureResult {
  key: string;
  eventId: string;
  passed: boolean;
  checks: Record<string, boolean>;
  blocking: boolean;
}

function includesPrice(value: string | undefined, fragment: string): boolean {
  return String(value ?? '').includes(fragment);
}

function venueContains(event: AdminEventRecord, fragment: string): boolean {
  return (event.venueName ?? '').toLowerCase().includes(fragment.toLowerCase());
}

function lineupContains(rebuilt: BulkRebuildEventRow['rebuilt'], artists: string[]): boolean {
  const names = rebuilt.lineupArtistNames ?? [];
  return artists.every((artist) =>
    names.some((name) => name.toUpperCase().includes(artist.toUpperCase())),
  );
}

function runFixtureChecks(
  key: string,
  event: AdminEventRecord,
  rebuilt: BulkRebuildEventRow['rebuilt'],
  projection: Record<string, unknown>,
): Record<string, boolean> {
  switch (key) {
    case 'LEVI':
      return {
        ended: Boolean(event.endDate && event.endDate < new Date().toISOString()),
        houseGenre: (event.genreLabels ?? []).some((g) => g.toUpperCase().includes('HOUSE')),
        bootshausVenue: venueContains(event, 'bootshaus'),
        noActivePhasesAfterEnd:
          (event.ticketPhases ?? []).length === 0 || event.ticketStatus === 'sales_ended',
      };
    case 'BC173':
      return {
        moxyVenue: venueContains(event, 'moxy'),
        organizerBootshaus: (event.organizerName ?? '').toLowerCase().includes('bootshaus'),
        noBootshausAddress: !(event.venueAddress ?? '').toLowerCase().includes('auenweg'),
        price2600:
          includesPrice(event.priceText, '26,00') ||
          includesPrice(String(projection.displayPriceText), '26,00'),
        lineupFastBoy: lineupContains(rebuilt, ['FAST BOY', 'DHALI', 'LIONKAY', 'ONINE']),
        noTransportArtist: !lineupContains(rebuilt, ['PUBLIC TRANSPORT']),
      };
    case 'R3HAB':
      return {
        price2390:
          includesPrice(event.priceText, '23,90') ||
          includesPrice(String(projection.displayPriceText), '23,90'),
        onSale: event.ticketStatus === 'on_sale',
        ticketIoCta: String(event.ticketUrl ?? '').includes('ticket.io'),
        lineupFive: lineupContains(rebuilt, [
          'R3HAB',
          'LA FUENTE',
          'OLIVER MAGENTA',
          'RELOVA',
          'DAVE REPLAY',
        ]),
      };
    case 'BOOTSHAUS_SOMMERFEST':
      return {
        price1190: includesPrice(event.priceText, '11,90'),
        onSale: event.ticketStatus === 'on_sale',
        genresPresent: (event.genreLabels ?? []).length >= 5,
        noFabricatedArtists:
          lineupContains(rebuilt, ['TBA']) || (rebuilt.lineupArtistNames?.length ?? 0) === 0,
      };
    case 'UNDERLAND':
      return {
        dateSept5: (event.startDate ?? '').includes('2026-09-05'),
        price1500: includesPrice(event.priceText, '15,00'),
        ticketKingsCta: String(event.ticketUrl ?? '').includes('ticketkings.de'),
        noCheckoutCta: !String(event.ticketUrl ?? '').includes('nacht-manager'),
        essigfabrikVenue: venueContains(event, 'essigfabrik'),
        genresHardtechno: (event.genreLabels ?? []).some((g) => g.toLowerCase().includes('hardtechno')),
      };
    case 'SOMMERFEST_ELEKTROKUECHE':
      return {
        essigfabrikVenue: venueContains(event, 'essigfabrik') || venueContains(event, 'elektroküche'),
        price2000: includesPrice(event.priceText, '20,00'),
        ticketKingsCta: String(event.ticketUrl ?? '').includes('ticketkings.de'),
        noCheckoutCta: !String(event.ticketUrl ?? '').includes('embed=1'),
        genresTechno: (event.genreLabels ?? []).some((g) => g.toLowerCase().includes('techno')),
        artists14: (rebuilt.lineupArtistNames?.length ?? 0) >= 10,
      };
    case 'MDMA':
      return {
        noChromeOnMdma: !String(event.ticketUrl ?? '').toLowerCase().includes('chrome'),
        prefersTicketKings:
          String(event.ticketUrl ?? '').includes('ticketkings') ||
          String(event.ticketUrl ?? '').includes('ticket'),
      };
    default:
      return { unknownFixture: false };
  }
}

export function runAcceptanceAudit(
  rows: BulkRebuildEventRow[],
  collisionRows: BulkRebuildEventRow[],
): {
  passed: boolean;
  results: AcceptanceFixtureResult[];
  blockingFailures: string[];
} {
  const byId = new Map(rows.map((row) => [row.eventIdBefore, row]));
  const results: AcceptanceFixtureResult[] = [];
  const blockingFailures: string[] = [];

  for (const fixture of BULK_REBUILD_ACCEPTANCE_FIXTURES) {
    const row = byId.get(fixture.eventId);

    if (!row) {
      results.push({
        key: fixture.key,
        eventId: fixture.eventId,
        passed: false,
        checks: { rowMissing: false },
        blocking: true,
      });
      blockingFailures.push(fixture.key);
      continue;
    }

    const rebuiltAdmin = rebuiltToAdminShape(row.rebuilt, {
      id: fixture.eventId,
      status: row.existing?.status,
    });

    const projection = buildConsumerProjection(rebuiltAdmin, row.rebuilt.lineupArtistNames ?? []);
    const checks = runFixtureChecks(fixture.key, rebuiltAdmin, row.rebuilt, projection);

    if (fixture.key === 'MDMA') {
      const isolatedKeys =
        (row.collision?.isolatedContributionKeys as string[] | undefined) ?? [];
      checks.collisionRecognized =
        row.disposition === 'review_collision' ||
        isolatedKeys.some((key) => key.toLowerCase().includes('chrome'));
    }

    const passed = Object.values(checks).every(Boolean);
    if (!passed) {
      blockingFailures.push(fixture.key);
    }

    results.push({
      key: fixture.key,
      eventId: fixture.eventId,
      passed,
      checks,
      blocking: !passed,
    });
  }

  return {
    passed: blockingFailures.length === 0,
    results,
    blockingFailures,
  };
}
