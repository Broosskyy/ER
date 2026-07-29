import { describe, expect, it } from 'vitest';

import { mapOpenDataApiEvent } from '@/features/aggregation/connectors/open-data-api-mapper';
import { OpenDataApiConnector } from '@/features/aggregation/connectors/open-data-api-connector';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import { createEternalRavePartnerV1SourceRecord, PARTNER_V1_FIELD_MAPPING } from '@/features/sources/production/eternal-rave-partner-v1-source';
import { PARTNER_V1_API_FIXTURE } from '@/features/sources/production/partner-v1-fixture';

describe('open data api mapper', () => {
  it('maps nested partner fields including artists and address', () => {
    const event = mapOpenDataApiEvent(PARTNER_V1_API_FIXTURE.data.events[0] as Record<string, unknown>, {
      sourceUrl: 'https://partner.example',
      index: 0,
      fieldMapping: PARTNER_V1_FIELD_MAPPING,
    });

    expect(event?.title).toBe('Warehouse Sessions Köln');
    expect(event?.venueName).toBe('Bootshaus');
    expect(event?.venueAddress).toContain('Auenweg');
    expect(event?.cityName).toBe('Köln');
    expect(event?.organizerName).toBe('Rheinland Nights');
    expect(event?.artistNames).toEqual(['Ben Klock', 'DVS1']);
    expect(event?.genreNames).toEqual(['Techno', 'Industrial']);
    expect(event?.ticketUrl).toContain('tickets.rheinland-nights.example');
    expect(event?.timezone).toBe('Europe/Berlin');
    expect(event?.sourceMetadata?.raw).toBeTruthy();
  });

  it('returns null when required fields are missing', () => {
    expect(
      mapOpenDataApiEvent({ id: 'x' }, { sourceUrl: '', index: 0 }),
    ).toBeNull();
  });
});

describe('Eternal Rave Partner V1 connector', () => {
  const sourceRecord = createEternalRavePartnerV1SourceRecord();
  const context: PipelineRunContext = {
    runId: 'partner-v1-run',
    source: mapSourceRecordToAggregationSource(sourceRecord),
    triggerType: 'manual',
    startedAt: new Date().toISOString(),
  };

  it('loads partner fixture events with full mapping', async () => {
    const connector = new OpenDataApiConnector();
    const events = await connector.fetchRawEvents(
      context.source,
      mapSourceRecordToImportSource(sourceRecord),
      context,
    );

    expect(events).toHaveLength(3);
    expect(events[0]?.externalId).toBe('rn-warehouse-2026');
    expect(events[0]?.artistNames?.length).toBe(2);
    expect(events[2]?.title).toBe('Minimal Listing');
    expect(events[2]?.cityName).toBe('Düsseldorf');
  });
});
