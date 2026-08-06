import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildNormalizedTicketEventHash } from '@/features/aggregation/connectors/ticket-platform/normalize-ticket-event';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import {
  createBootshausTicketIoProductionSourceRecord,
  createTicketIoShopSourceRecord,
} from '@/features/sources/production/ticket-io-source.core';
import { recordCandidateEquivalent } from '@/features/import/services/import-record-identity';
import type { ImportRecord } from '@/features/import/models/types';
import { mapNormalizedCandidateToCanonical } from '@/features/aggregation/domain/canonical-import-event';

const FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);

describe('Sprint 35 ticket.io production connector', () => {
  it('creates generic ticket.io shop sources with config-driven publish policy', () => {
    const enrichment = createBootshausTicketIoProductionSourceRecord();
    expect(enrichment.sourceConfig?.publishPolicy?.behavior).toBe('enrichment');
    expect(enrichment.id).toBe('source-bootshaus-ticket-io');

    const primary = createTicketIoShopSourceRecord({
      shopSlug: 'newclub',
      publishBehavior: 'auto_publish',
    });
    expect(primary.sourceConfig?.publishPolicy?.behavior).toBe('auto_publish');
    expect(primary.publishMode).toBe('auto_publish');
    expect(primary.id).toBe('source-ticket-io-newclub');
    expect(primary.sourceConfig?.ticketPlatform?.shopSlug).toBe('newclub');
  });

  it('attaches normalized hash and connector version to fetched events', async () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const sourceRecord = createBootshausTicketIoProductionSourceRecord({
      sourceConfig: {
        reference: { connectorKey: 'ticket_platform', html },
        ticketPlatform: {
          platform: 'ticket_io',
          shopSlug: 'bootshaus-club',
          listUrl: 'https://bootshaus-club.ticket.io/',
          timezone: 'Europe/Berlin',
          limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
          scope: { allowedVenues: ['bootshaus'] },
        },
        publishPolicy: { mode: 'manual_review', behavior: 'enrichment', blockOnDuplicate: false },
      },
    });

    const events = await fetchTicketPlatformEvents({
      source: mapSourceRecordToAggregationSource(sourceRecord),
      importSource: mapSourceRecordToImportSource(sourceRecord),
      connectorKey: 'ticket_platform',
      fixtureHtml: html,
    });

    expect(events.length).toBeGreaterThan(10);
    const first = events[0];
    expect(first?.sourceMetadata?.normalizedHash).toMatch(/^[a-f0-9]{32}$/);
    expect(first?.sourceMetadata?.connectorVersion).toBe('1.2.0');
    expect(first?.sourceMetadata?.syncRun).toMatchObject({ pagesProcessed: 1 });
  });

  it('skips updates when normalized hash is unchanged', () => {
    const hash = buildNormalizedTicketEventHash({
      title: 'Test Event',
      startDate: '2026-08-01T22:00:00+02:00',
      ticketUrl: 'https://club.ticket.io/event/1/',
      venueName: 'Club',
    });

    const record = {
      id: 'rec-1',
      importJobId: 'job-1',
      sourceId: 'source-1',
      externalId: 'https://club.ticket.io/event/1/',
      rawPayload: {
        sourceMetadata: { normalizedHash: hash },
      },
      normalizedPayload: {
        title: 'Old Title',
        startDate: '2026-08-01T22:00:00+02:00',
        normalizedHash: hash,
      },
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as ImportRecord;

    const candidate = mapNormalizedCandidateToCanonical(
      {
        externalId: record.externalId,
        title: 'Changed Title Should Be Ignored By Hash',
        startDate: '2026-08-01T22:00:00+02:00',
        venueName: 'Club',
        ticketUrl: 'https://club.ticket.io/event/1/',
        rawSourceType: 'json_ld',
        sourceMetadata: { normalizedHash: hash },
      },
      { id: 'source-1', name: 'Ticket.io' },
    );

    expect(recordCandidateEquivalent(record, candidate)).toBe(true);
  });
});
