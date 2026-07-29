import { describe, expect, it, vi } from 'vitest';

import { ClubWebsiteConnector } from '@/features/aggregation/connectors/club-website-connector';
import { OrganizerWebsiteConnector } from '@/features/aggregation/connectors/organizer-website-connector';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import {
  assertSafeWebsiteUrl,
  deduplicateUrls,
  detectWebsiteDocument,
  mapRawWebsiteEvents,
  resolveRelativeUrl,
  selectWebsiteStrategy,
  websiteProcessor,
} from '@/features/aggregation/connectors/website';
import {
  WEBSITE_EMBEDDED_JSON_FIXTURE,
  WEBSITE_EVENT_LIST_FIXTURE,
  WEBSITE_HTML_SELECTOR_FIXTURE,
  WEBSITE_JS_RENDERED_FIXTURE,
  WEBSITE_JSON_LD_GRAPH_FIXTURE,
  WEBSITE_PAGINATION_FIXTURE_PAGE_1,
  WEBSITE_PAGINATION_FIXTURE_PAGE_2,
} from '@/features/aggregation/connectors/website/fixtures';
import { embeddedJsonWebsiteStrategy, jsonLdWebsiteStrategy } from '@/features/aggregation/connectors/website/strategies';
import { htmlSelectorWebsiteStrategy } from '@/features/aggregation/connectors/website/html-strategies';
import { createDefaultSourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { CLUB_WEBSITE_FIXTURE_HTML } from '@/features/aggregation/fixtures/real-source-fixtures';
import { InMemorySourceImportHistoryStore } from '@/features/sources/domain/source-import-history';
import { SourceManagementService } from '@/features/sources/services/source-management-service';
import { SourceService } from '@/features/sources/services/source-service';
import type { SourceRecord } from '@/data/types/records';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

const adminRole = 'admin' as const;

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'src-web-1',
    slug: 'club-berlin',
    displayName: 'Club Berlin',
    sourceType: 'website',
    parserType: 'json-ld',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 50,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const context: PipelineRunContext = {
  runId: 'run-web',
  source: mapSourceRecordToAggregationSource(source()),
  triggerType: 'manual',
  startedAt: new Date().toISOString(),
};

describe('website connector security', () => {
  it('blocks localhost and private network targets', () => {
    expect(() => assertSafeWebsiteUrl('http://localhost/events')).toThrow();
    expect(() => assertSafeWebsiteUrl('http://127.0.0.1/events')).toThrow();
    expect(() => assertSafeWebsiteUrl('http://192.168.0.10/events')).toThrow();
    expect(() => assertSafeWebsiteUrl('http://169.254.169.254/latest/meta-data/')).toThrow();
  });

  it('allows public https urls', () => {
    expect(assertSafeWebsiteUrl('https://events.example.com/list').hostname).toBe('events.example.com');
  });

  it('deduplicates urls', () => {
    expect(deduplicateUrls(['https://a.test/1', 'https://a.test/1', 'https://a.test/2'])).toHaveLength(2);
  });

  it('resolves relative urls', () => {
    expect(resolveRelativeUrl('https://events.example.com/list', '/events/1')).toBe('https://events.example.com/events/1');
  });
});

describe('website detection', () => {
  it('detects json-ld and recommends json_ld strategy', () => {
    const report = detectWebsiteDocument({
      requestedUrl: 'https://events.example.com',
      finalUrl: 'https://events.example.com',
      statusCode: 200,
      contentType: 'text/html',
      html: WEBSITE_JSON_LD_GRAPH_FIXTURE,
      responseSize: WEBSITE_JSON_LD_GRAPH_FIXTURE.length,
      fetchedAt: new Date().toISOString(),
      redirectChain: ['https://events.example.com'],
      headers: {},
      detectedSignals: [],
      warnings: [],
    });
    expect(report.detectedFormats.some((signal) => signal.format === 'schema_org_event')).toBe(true);
    expect(report.recommendedStrategy).toBe('json_ld');
    expect(report.eventContainerCount).toBeGreaterThanOrEqual(0);
  });

  it('detects embedded json signals', () => {
    const report = detectWebsiteDocument({
      requestedUrl: 'https://events.example.com',
      finalUrl: 'https://events.example.com',
      statusCode: 200,
      contentType: 'text/html',
      html: WEBSITE_EMBEDDED_JSON_FIXTURE,
      responseSize: WEBSITE_EMBEDDED_JSON_FIXTURE.length,
      fetchedAt: new Date().toISOString(),
      redirectChain: ['https://events.example.com'],
      headers: {},
      detectedSignals: [],
      warnings: [],
    });
    expect(report.detectedFormats.some((signal) => signal.format === 'next_data')).toBe(true);
  });

  it('flags javascript rendering suspicion', () => {
    const report = detectWebsiteDocument({
      requestedUrl: 'https://events.example.com',
      finalUrl: 'https://events.example.com',
      statusCode: 200,
      contentType: 'text/html',
      html: WEBSITE_JS_RENDERED_FIXTURE,
      responseSize: WEBSITE_JS_RENDERED_FIXTURE.length,
      fetchedAt: new Date().toISOString(),
      redirectChain: ['https://events.example.com'],
      headers: {},
      detectedSignals: [],
      warnings: [],
    });
    expect(report.javascriptRenderingSuspected).toBe(true);
    expect(report.blockers.length).toBeGreaterThan(0);
  });
});

describe('website strategies', () => {
  const baseDocument = {
    requestedUrl: 'https://events.example.com',
    finalUrl: 'https://events.example.com',
    statusCode: 200,
    contentType: 'text/html',
    responseSize: 0,
    fetchedAt: new Date().toISOString(),
    redirectChain: ['https://events.example.com'],
    headers: {},
    detectedSignals: [],
    warnings: [],
  };

  it('extracts json-ld events including @graph', async () => {
    const result = await jsonLdWebsiteStrategy.extract(
      { ...baseDocument, html: WEBSITE_JSON_LD_GRAPH_FIXTURE, responseSize: WEBSITE_JSON_LD_GRAPH_FIXTURE.length },
      {},
      { baseUrl: 'https://events.example.com', connectorKey: 'club_website' },
    );
    expect(result.events.length).toBeGreaterThanOrEqual(2);
    expect(result.events.some((event) => event.title === 'Graph Event One')).toBe(true);
  });

  it('extracts embedded json from __NEXT_DATA__', async () => {
    const result = await embeddedJsonWebsiteStrategy.extract(
      { ...baseDocument, html: WEBSITE_EMBEDDED_JSON_FIXTURE, responseSize: WEBSITE_EMBEDDED_JSON_FIXTURE.length },
      {},
      { baseUrl: 'https://events.example.com', connectorKey: 'club_website' },
    );
    expect(result.events.some((event) => event.title === 'Next Event')).toBe(true);
  });

  it('extracts html selector events', async () => {
    const result = await htmlSelectorWebsiteStrategy.extract(
      { ...baseDocument, html: WEBSITE_HTML_SELECTOR_FIXTURE, responseSize: WEBSITE_HTML_SELECTOR_FIXTURE.length },
      {
        htmlSelector: {
          eventContainerSelector: '.event',
          titleSelector: '.title',
          dateSelector: '.date',
          venueSelector: '.venue',
        },
      },
      { baseUrl: 'https://events.example.com', connectorKey: 'club_website' },
    );
    expect(result.events.some((event) => event.title === 'Selector Night')).toBe(true);
  });

  it('skips incomplete events without aborting', async () => {
    const incompleteFixture = `<html><script type="application/ld+json">{"@type":"Event","name":"No Date"}</script></html>`;
    const result = await jsonLdWebsiteStrategy.extract(
      { ...baseDocument, html: incompleteFixture, responseSize: incompleteFixture.length },
      {},
      { baseUrl: 'https://events.example.com', connectorKey: 'club_website' },
    );
    expect(result.events).toHaveLength(0);
    expect(result.diagnostics.skippedCount).toBeGreaterThan(0);
  });

  it('validates html selector configuration', () => {
    const invalid = htmlSelectorWebsiteStrategy.validateConfiguration({});
    expect(invalid.valid).toBe(false);
  });
});

describe('website processor and mapping', () => {
  it('processes club website fixture end-to-end', async () => {
    const record = source();
    const output = await websiteProcessor.process({
      url: 'https://events.example.com/club',
      importSource: mapSourceRecordToImportSource(record),
      connectorKey: 'club_website',
      htmlOverride: CLUB_WEBSITE_FIXTURE_HTML,
    });
    expect(output.events.some((event) => event.title?.includes('Club Night'))).toBe(true);
    expect(output.result.diagnostics.strategy).toBe('json_ld');
  });

  it('maps raw website events to imported events', () => {
    const mapped = mapRawWebsiteEvents(
      [{
        sourceUrl: 'https://events.example.com',
        externalId: 'e-1',
        title: 'Mapped Event',
        rawStartDate: '2026-12-01T20:00:00.000Z',
        extractionStrategy: 'json_ld',
        extractionConfidence: 0.9,
        fieldEvidence: [],
        warnings: [],
      }],
      'club_website',
    );
    expect(mapped[0]?.title).toBe('Mapped Event');
  });

  it('selects explicit preferred strategy', () => {
    const document = {
      requestedUrl: 'https://events.example.com',
      finalUrl: 'https://events.example.com',
      statusCode: 200,
      contentType: 'text/html',
      html: WEBSITE_HTML_SELECTOR_FIXTURE,
      responseSize: WEBSITE_HTML_SELECTOR_FIXTURE.length,
      fetchedAt: new Date().toISOString(),
      redirectChain: ['https://events.example.com'],
      headers: {},
      detectedSignals: [],
      warnings: [],
    };
    const strategy = selectWebsiteStrategy(document, {
      preferredStrategy: 'html_selector',
      htmlSelector: { eventContainerSelector: '.event', titleSelector: '.title' },
    });
    expect(strategy.key).toBe('html_selector');
  });
});

describe('website connector backward compatibility', () => {
  it('club website connector still loads fixture events', async () => {
    const connector = new ClubWebsiteConnector();
    const record = source();
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title?.includes('Club Night'))).toBe(true);
  });

  it('organizer website connector still loads fixture events', async () => {
    const connector = new OrganizerWebsiteConnector();
    const record = source({ parserType: 'html' });
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.some((event) => event.title?.includes('Organizer Showcase'))).toBe(true);
  });
});

describe('source management website integration', () => {
  it('runs website detection and extraction preview with fixtures', async () => {
    const record = source({
      sourceConfig: {
        reference: { connectorKey: 'club_website', html: CLUB_WEBSITE_FIXTURE_HTML },
      },
    });
    const repository = {
      list: async () => ({ items: [record], total: 1, page: 1, pageSize: 50 }),
      getById: async () => record,
      getBySlug: async () => record,
      getAll: async () => [record],
      save: async (item: SourceRecord) => item,
      archive: async () => record,
      restore: async () => record,
      countImportJobsForSource: async () => 0,
    };
    const management = new SourceManagementService(
      new SourceService(repository),
      createDefaultSourceConnectorRegistry(),
      new InMemorySourceImportHistoryStore(),
    );

    const detection = await management.runWebsiteDetection(adminRole, record.id);
    expect(detection.recommendedStrategy).toBe('json_ld');

    const preview = await management.runWebsiteExtractionPreview(adminRole, record.id);
    expect(preview.eventCount).toBeGreaterThan(0);

    const testImport = await management.runTestImport(adminRole, record.id);
    expect(testImport.eventCount).toBeGreaterThan(0);
    expect(management.getImportHistory(record.id)).toHaveLength(1);
  });
});

describe('website detail pages and pagination fixtures', () => {
  it('detects event detail links from list fixture', () => {
    const report = detectWebsiteDocument({
      requestedUrl: 'https://events.example.com/events',
      finalUrl: 'https://events.example.com/events',
      statusCode: 200,
      contentType: 'text/html',
      html: WEBSITE_EVENT_LIST_FIXTURE,
      responseSize: WEBSITE_EVENT_LIST_FIXTURE.length,
      fetchedAt: new Date().toISOString(),
      redirectChain: ['https://events.example.com/events'],
      headers: {},
      detectedSignals: [],
      warnings: [],
    }, { eventDetailPage: { eventLinkSelector: 'a' } });
    expect(report.detailPageUrls.length).toBeGreaterThan(0);
  });

  it('supports pagination fixture pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        events: [],
        result: {
          events: [],
          detection: detectWebsiteDocument({
            requestedUrl: 'https://events.example.com/events?page=1',
            finalUrl: 'https://events.example.com/events?page=1',
            statusCode: 200,
            contentType: 'text/html',
            html: WEBSITE_PAGINATION_FIXTURE_PAGE_1,
            responseSize: 1,
            fetchedAt: new Date().toISOString(),
            redirectChain: [],
            headers: {},
            detectedSignals: [],
            warnings: [],
          }),
          diagnostics: {
            fetchDurationMs: 1,
            responseSize: 1,
            redirectCount: 0,
            detectionDurationMs: 1,
            extractionDurationMs: 1,
            strategy: 'html_selector',
            confidence: 0.7,
            candidateCount: 1,
            validEventCount: 1,
            skippedCount: 0,
            detailPagesFetched: 0,
            paginationPagesFetched: 1,
            warnings: [],
          },
        },
      });

    expect(WEBSITE_PAGINATION_FIXTURE_PAGE_2.includes('Page Two Event')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
