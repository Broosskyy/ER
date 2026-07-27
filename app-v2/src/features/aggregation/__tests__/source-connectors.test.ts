import { describe, expect, it } from 'vitest';

import { ManualReferenceConnector } from '@/features/aggregation/connectors/manual-reference-connector';
import { ClubWebsiteConnector } from '@/features/aggregation/connectors/club-website-connector';
import { OrganizerWebsiteConnector } from '@/features/aggregation/connectors/organizer-website-connector';
import { IcalFeedConnector } from '@/features/aggregation/connectors/ical-feed-connector';
import { OpenDataApiConnector } from '@/features/aggregation/connectors/open-data-api-connector';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { SourceRecord } from '@/data/types/records';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-test',
    slug: 'test-source',
    displayName: 'Test Source',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 50,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

const context: PipelineRunContext = {
  runId: 'run-test',
  source: mapSourceRecordToAggregationSource(source()),
  triggerType: 'manual',
  startedAt: new Date().toISOString(),
};

describe('real source connectors', () => {
  it('loads manual reference events', async () => {
    const connector = new ManualReferenceConnector();
    const record = source({ sourceType: 'manual' });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.title).toBeTruthy();
  });

  it('loads club website JSON-LD events', async () => {
    const connector = new ClubWebsiteConnector();
    const record = source({ sourceType: 'website', parserType: 'json-ld' });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title?.includes('Club Night'))).toBe(true);
  });

  it('loads organizer website events', async () => {
    const connector = new OrganizerWebsiteConnector();
    const record = source({ sourceType: 'website', parserType: 'html' });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title?.includes('Organizer Showcase'))).toBe(true);
  });

  it('loads ical feed events from fixture', async () => {
    const connector = new IcalFeedConnector();
    const record = source({
      sourceType: 'ical',
      parserType: 'ical',
      sourceConfig: { reference: { connectorKey: 'ical_feed', ical: undefined } },
    });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title === 'iCal Party')).toBe(true);
  });

  it('loads open data API events from fixture', async () => {
    const connector = new OpenDataApiConnector();
    const record = source({
      sourceType: 'api',
      parserType: 'api',
      sourceConfig: {
        api: { fieldMapping: { title: 'name', startDate: 'starts_at' } },
      },
    });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title === 'Open Data Festival')).toBe(true);
  });
});
