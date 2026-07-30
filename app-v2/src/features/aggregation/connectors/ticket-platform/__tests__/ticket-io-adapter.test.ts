import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { normalizeTicketTimezone } from '@/features/aggregation/connectors/ticket-platform/normalize-ticket-event';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source.fixtures.server';

const FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);

describe('ticket.io adapter', () => {
  it('parses MusicEvent JSON-LD blocks from shop list HTML', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const result = parseTicketIoShopHtml(html, {
      platform: 'ticket_io',
      shopSlug: 'bootshaus-club',
      timezone: 'Europe/Berlin',
      scope: { allowedVenues: ['bootshaus'] },
    });

    expect(result.scopeStats.discovered).toBeGreaterThan(10);
    expect(result.scopeStats.accepted).toBeGreaterThan(10);
    expect(result.events[0]?.ticketUrl).toMatch(/bootshaus-club\.ticket\.io/);
    expect(result.events[0]?.timezone).toBe('Europe/Berlin');
  });

  it('normalizes offset datetimes to IANA timezone', () => {
    expect(normalizeTicketTimezone('2026-08-01T22:00:00+02:00')).toBe('Europe/Berlin');
  });

  it('fetches raw events through ticket platform connector fetch', async () => {
    const sourceRecord = createBootshausTicketIoProductionSourceRecord();
    const events = await fetchTicketPlatformEvents({
      source: mapSourceRecordToAggregationSource(sourceRecord),
      importSource: mapSourceRecordToImportSource(sourceRecord),
      connectorKey: 'ticket_platform',
    });

    expect(events.length).toBeGreaterThan(10);
    expect(events.every((event) => event.timezone === 'Europe/Berlin')).toBe(true);
    expect(events.every((event) => event.ticketUrl?.includes('ticket.io'))).toBe(true);
    expect(events[0]?.sourceMetadata).toMatchObject({
      platform: 'ticket_io',
      enrichmentSource: true,
    });
  });
});
