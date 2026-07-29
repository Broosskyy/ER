import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { OrganizerWebsiteConnector } from '@/features/aggregation/connectors/organizer-website-connector';
import { detectWebsiteDocument } from '@/features/aggregation/connectors/website/detection';
import { jsonLdWebsiteStrategy } from '@/features/aggregation/connectors/website/strategies';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { eventNormalizer } from '@/features/import/normalization/event-normalizer';
import {
  AFFENKAEFIG_EVENTS_URL,
  AFFENKAEFIG_ORGANIZER_ID,
  AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
  AFFENKAEFIG_SOURCE_ID,
  AFFENKAEFIG_WEBSITE_CONFIG,
  createAffenkaefigSourceRecord,
} from '@/features/sources/production/affenkaefig-source';
import { AFFENKAEFIG_LIST_FIXTURE_HTML } from '@/features/sources/production/affenkaefig-fixture';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

const pipelineContext: PipelineRunContext = {
  runId: 'test-run',
  trigger: 'manual',
  startedAt: new Date().toISOString(),
};

describe('Affenkäfig production source configuration', () => {
  it('defines organizer/festival roles with json_ld strategy and disabled by default', () => {
    const record = createAffenkaefigSourceRecord();
    expect(record.id).toBe(AFFENKAEFIG_SOURCE_ID);
    expect(record.connectorKey).toBe(AFFENKAEFIG_SOURCE_CONNECTOR_KEY);
    expect(record.sourceRoles).toEqual(['organizer', 'festival']);
    expect(record.enabled).toBe(false);
    expect(record.publishMode).toBe('manual_review');
    expect(record.reviewRequired).toBe(true);
    expect(record.sourceConfig?.website?.preferredStrategy).toBe('json_ld');
    expect(record.organizerId).toBe(AFFENKAEFIG_ORGANIZER_ID);
    expect(record.sourceConfig?.defaults?.venueId).toBeUndefined();
  });

  it('uses fixture HTML only in test factory reference block', () => {
    const record = createAffenkaefigSourceRecord();
    expect(record.sourceConfig?.reference?.html).toContain('application/ld+json');
  });
});

describe('Affenkäfig JSON-LD connector extraction', () => {
  const record = createAffenkaefigSourceRecord();
  const importSource = mapSourceRecordToImportSource(record);
  const baseDocument = {
    requestedUrl: AFFENKAEFIG_EVENTS_URL,
    finalUrl: AFFENKAEFIG_EVENTS_URL,
    statusCode: 200,
    contentType: 'text/html',
    html: AFFENKAEFIG_LIST_FIXTURE_HTML,
    responseSize: AFFENKAEFIG_LIST_FIXTURE_HTML.length,
    fetchedAt: new Date().toISOString(),
    redirectChain: [AFFENKAEFIG_EVENTS_URL],
    headers: {},
    detectedSignals: [],
    warnings: [],
  };

  it('detects json_ld from @graph fixture', () => {
    const report = detectWebsiteDocument(baseDocument);
    expect(report.recommendedStrategy).toBe('json_ld');
    expect(report.detectedFormats.some((signal) => signal.format === 'schema_org_event')).toBe(true);
  });

  it('extracts festival and music events with stable external IDs from URLs', async () => {
    const result = await jsonLdWebsiteStrategy.extract(
      baseDocument,
      AFFENKAEFIG_WEBSITE_CONFIG,
      { baseUrl: AFFENKAEFIG_EVENTS_URL, connectorKey: AFFENKAEFIG_SOURCE_CONNECTOR_KEY },
    );
    expect(result.events.length).toBe(2);
    expect(result.events.some((event) => event.title?.includes('Open Air'))).toBe(true);
    expect(result.events.some((event) => event.title?.includes('Warehouse'))).toBe(true);
    expect(result.events.every((event) => event.externalId.includes('affenkaefig.de'))).toBe(true);
  });

  it('normalizes Europe/Berlin datetimes without inventing missing fields', async () => {
    const output = await websiteProcessor.process({
      url: AFFENKAEFIG_EVENTS_URL,
      importSource,
      connectorKey: AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
      htmlOverride: AFFENKAEFIG_LIST_FIXTURE_HTML,
    });
    expect(output.events.length).toBeGreaterThanOrEqual(2);
    const sample = output.events[0]!;
    const normalized = eventNormalizer.normalize({
      externalId: sample.externalId,
      sourceUrl: sample.sourceUrl,
      title: sample.title,
      description: sample.description,
      startDate: sample.startDate,
      endDate: sample.endDate,
      timezone: sample.timezone ?? 'Europe/Berlin',
      venueName: sample.venueName,
      organizerName: sample.organizerName,
      eventUrl: sample.eventUrl,
      imageUrl: sample.imageUrl,
      ticketUrl: sample.ticketUrl,
      rawSourceType: 'json_ld',
    });
    expect(normalized.candidate?.title.length).toBeGreaterThan(0);
    expect(normalized.candidate?.startDate).toMatch(/2026-/);
    expect(normalized.candidate?.organizerName).toBe('Affenkäfig');
  });

  it('routes through organizer_website connector with fixture reference HTML', async () => {
    const connector = new OrganizerWebsiteConnector();
    const aggregationSource = mapSourceRecordToAggregationSource(record);
    const events = await connector.fetchRawEvents(aggregationSource, importSource, pipelineContext);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.every((event) => event.sourceMetadata?.connector === AFFENKAEFIG_SOURCE_CONNECTOR_KEY)).toBe(
      true,
    );
  });

  it('assigns per-event venue names without forcing a single canonical venue', async () => {
    const output = await websiteProcessor.process({
      url: AFFENKAEFIG_EVENTS_URL,
      importSource,
      connectorKey: AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
      htmlOverride: AFFENKAEFIG_LIST_FIXTURE_HTML,
    });
    const venues = new Set(output.events.map((event) => event.venueName).filter(Boolean));
    expect(venues.size).toBeGreaterThanOrEqual(2);
  });
});
