import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  parseTicketKingsEventDetailHtml,
  parseTicketKingsShopHtml,
} from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { normalizeTicketTimezone } from '@/features/aggregation/connectors/ticket-platform/normalize-ticket-event';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { createAffenkaefigTicketKingsProductionSourceRecord } from '@/features/sources/production/ticket-kings-source.fixtures.server';

const LIST_FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-affenkaefig-events.html',
);
const DETAIL_FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-event-detail.html',
);

describe('ticket kings adapter', () => {
  const config = {
    platform: 'ticket_king' as const,
    shopSlug: 'ticketkings',
    listUrl: 'https://ticketkings.de/all-events/',
    timezone: 'Europe/Berlin',
    scope: {
      allowedVenues: ['essigfabrik', 'elektroküche'],
      allowedOrganizers: ['affenkaefig', 'mdma', 'underland', 'elektroküche'],
    },
  };

  it('parses Tribe Events JSON-LD blocks from list HTML', () => {
    const html = readFileSync(LIST_FIXTURE_PATH, 'utf8');
    const result = parseTicketKingsShopHtml(html, config);

    expect(result.scopeStats.discovered).toBe(5);
    expect(result.scopeStats.accepted).toBeGreaterThanOrEqual(4);
    expect(result.events[0]?.ticketUrl).toMatch(/ticketkings\.de\/event\//);
    expect(result.events[0]?.timezone).toBe('Europe/Berlin');
    expect(result.events.every((event) => event.platform === 'ticket_king')).toBe(true);
  });

  it('parses event detail page with checkout provider metadata', () => {
    const html = readFileSync(DETAIL_FIXTURE_PATH, 'utf8');
    const event = parseTicketKingsEventDetailHtml(html, config);

    expect(event?.title).toContain('MDMA');
    expect(event?.venueName).toBe('Essigfabrik');
    expect(event?.checkoutProviderId).toBe('24');
    expect(event?.ticketUrl).toContain('mdma-musik-die-mich-antreibt');
  });

  it('normalizes offset datetimes to IANA timezone', () => {
    expect(normalizeTicketTimezone('2026-08-15T23:00:00+02:00')).toBe('Europe/Berlin');
  });

  it('fetches raw events through ticket platform connector fetch', async () => {
    const sourceRecord = createAffenkaefigTicketKingsProductionSourceRecord();
    const events = await fetchTicketPlatformEvents({
      source: mapSourceRecordToAggregationSource(sourceRecord),
      importSource: mapSourceRecordToImportSource(sourceRecord),
      connectorKey: 'ticket_platform',
    });

    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events.every((event) => event.timezone === 'Europe/Berlin')).toBe(true);
    expect(events.every((event) => event.ticketUrl?.includes('ticketkings.de'))).toBe(true);
    expect(events[0]?.sourceMetadata).toMatchObject({
      platform: 'ticket_king',
      enrichmentSource: true,
    });
  });
});
