import { describe, expect, it, vi } from 'vitest';

import { ApiJsonImportAdapter } from '@/features/import/adapters/api-json-adapter';
import { CsvImportAdapter } from '@/features/import/adapters/csv-adapter';
import { atomImportAdapter, rssImportAdapter } from '@/features/import/adapters/feed-adapter';
import { IcalImportAdapter } from '@/features/import/adapters/ical-adapter';
import { JsonLdImportAdapter } from '@/features/import/adapters/json-ld-adapter';
import { collectJsonLdNodes, extractJsonLdBlocks } from '@/features/import/adapters/parsers/json-ld-parser';
import { parseCsv } from '@/features/import/adapters/parsers/csv-parser';
import { eventNormalizer } from '@/features/import/normalization/event-normalizer';
import { normalizeText } from '@/features/import/normalization/text-normalizer';
import { validateUrl } from '@/features/import/normalization/url-normalizer';
import { importCandidateValidator } from '@/features/import/validation/import-candidate-validator';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import * as fetchModule from '@/features/import/services/import-fetch-service';
import {
  API_JSON,
  ATOM_FEED,
  CSV_CONTENT,
  ICAL_ALL_DAY,
  ICAL_EVENT,
  JSON_LD_GRAPH,
  JSON_LD_SINGLE_EVENT,
  RSS_FEED,
} from './fixtures/import-fixtures';

const noopContext = {
  jobId: 'job-test',
  log: async () => undefined,
};

function mockFetch(body: string, contentType: string) {
  vi.spyOn(fetchModule.importFetchService, 'fetch').mockResolvedValue({
    url: 'https://example.com/source',
    status: 200,
    contentType,
    body,
    bytesRead: body.length,
  });
}

describe('JSON-LD parser', () => {
  it('extracts single event from HTML', () => {
    const blocks = extractJsonLdBlocks(JSON_LD_SINGLE_EVENT);
    expect(blocks.length).toBe(1);
    const events = collectJsonLdNodes(blocks[0]);
    expect(events.length).toBe(1);
    expect(events[0]?.name).toBe('Techno Night');
  });

  it('extracts events from @graph', () => {
    const events = collectJsonLdNodes(JSON.parse(JSON_LD_GRAPH));
    expect(events.length).toBe(1);
    expect(events[0]?.name).toBe('Graph Event');
  });
});

describe('JSON-LD adapter', () => {
  it('imports structured event', async () => {
    mockFetch(JSON_LD_SINGLE_EVENT, 'text/html');
    const adapter = new JsonLdImportAdapter();
    const result = await adapter.execute(
      {
        id: 'src',
        name: 'JSON-LD',
        type: 'json_ld',
        sourceUrl: 'https://example.com/events',
        trustScore: 1,
        active: true,
        adapterKey: 'json_ld',
      },
      noopContext,
    );
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records[0]?.status).toBe('needs_review');
  });
});

describe('RSS adapter', () => {
  it('parses RSS feed item', async () => {
    mockFetch(RSS_FEED, 'application/rss+xml');
    const result = await rssImportAdapter.execute(
      {
        id: 'src',
        name: 'RSS',
        type: 'rss',
        sourceUrl: 'https://example.com/feed.xml',
        trustScore: 1,
        active: true,
        adapterKey: 'rss',
      },
      noopContext,
    );
    expect(result.records[0]?.rawPayload).toBeTruthy();
  });
});

describe('Atom adapter', () => {
  it('parses Atom entry', async () => {
    mockFetch(ATOM_FEED, 'application/atom+xml');
    const result = await atomImportAdapter.execute(
      {
        id: 'src',
        name: 'Atom',
        type: 'atom',
        sourceUrl: 'https://example.com/atom.xml',
        trustScore: 1,
        active: true,
        adapterKey: 'atom',
      },
      noopContext,
    );
    expect(result.records.length).toBe(1);
  });
});

describe('iCal adapter', () => {
  it('parses VEVENT', async () => {
    mockFetch(ICAL_EVENT, 'text/calendar');
    const adapter = new IcalImportAdapter();
    const result = await adapter.execute(
      {
        id: 'src',
        name: 'iCal',
        type: 'ical',
        sourceUrl: 'https://example.com/cal.ics',
        trustScore: 1,
        active: true,
        adapterKey: 'ical',
      },
      noopContext,
    );
    expect(result.records[0]?.externalId).toBe('test-uid-1');
    expect(result.records[0]?.status).toBe('needs_review');
  });

  it('handles all-day events', async () => {
    mockFetch(ICAL_ALL_DAY, 'text/calendar');
    const adapter = new IcalImportAdapter();
    const result = await adapter.execute(
      {
        id: 'src',
        name: 'iCal',
        type: 'ical',
        sourceUrl: 'https://example.com/cal.ics',
        trustScore: 1,
        active: true,
        adapterKey: 'ical',
      },
      noopContext,
    );
    expect(result.records[0]?.normalizedCandidate?.isAllDay).toBe(true);
  });
});

describe('CSV adapter', () => {
  it('parses comma-separated rows with mapping', async () => {
    mockFetch(CSV_CONTENT, 'text/csv');
    const adapter = new CsvImportAdapter();
    const result = await adapter.execute(
      {
        id: 'src',
        name: 'CSV',
        type: 'csv',
        sourceUrl: 'https://example.com/events.csv',
        trustScore: 1,
        active: true,
        adapterKey: 'csv',
        sourceConfig: {
          csv: {
            fieldMapping: {
              externalId: 'external_id',
              title: 'title',
              description: 'description',
              startDate: 'start_date',
              cityName: 'city_name',
            },
          },
        },
      },
      noopContext,
    );
    expect(result.records.some((record) => record.status === 'needs_review')).toBe(true);
    expect(result.records.some((record) => record.status === 'invalid')).toBe(true);
  });

  it('parses quoted CSV fields', () => {
    const parsed = parseCsv('title,description\n"Hello, World","Line 1\nLine 2"', {
      delimiter: ',',
      hasHeader: true,
    });
    expect(parsed.rows[0]?.[0]).toBe('Hello, World');
  });
});

describe('API JSON adapter', () => {
  it('parses list from configured path', async () => {
    mockFetch(API_JSON, 'application/json');
    const adapter = new ApiJsonImportAdapter();
    const result = await adapter.execute(
      {
        id: 'src',
        name: 'API',
        type: 'api_json',
        sourceUrl: 'https://api.example.com/events',
        trustScore: 1,
        active: true,
        adapterKey: 'api_json',
        sourceConfig: {
          api: {
            resultsPath: 'events',
            fieldMapping: {
              externalId: 'id',
              title: 'name',
              startDate: 'starts_at',
              cityName: 'city',
            },
          },
        },
      },
      noopContext,
    );
    expect(result.records[0]?.externalId).toBe('api-1');
  });
});

describe('Normalizer', () => {
  it('strips HTML and normalizes whitespace', () => {
    expect(normalizeText('<p>Hello   <b>world</b></p>')).toBe('Hello world');
  });

  it('resolves relative URLs', () => {
    expect(validateUrl('/events/1', 'https://example.com').url).toBe('https://example.com/events/1');
  });

  it('normalizes candidate with timezone warning', () => {
    const { candidate, warnings } = eventNormalizer.normalize({
      externalId: '1',
      title: 'Test',
      startDate: '2026-08-01T20:00:00',
      cityName: 'Köln',
      rawSourceType: 'unknown',
      defaultTimezone: 'Europe/Berlin',
    });
    expect(candidate?.title).toBe('Test');
    expect(warnings.some((warning) => warning.code === 'TIMEZONE_MISSING')).toBe(true);
  });
});

describe('Validator', () => {
  it('accepts valid candidate', () => {
    const result = importCandidateValidator.validate({
      externalId: '1',
      title: 'Valid Event',
      startDate: '2026-08-01T20:00:00.000Z',
      endDate: '2026-08-02T02:00:00.000Z',
      cityName: 'Köln',
      rawSourceType: 'json_ld',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects missing title', () => {
    const result = importCandidateValidator.validate({
      externalId: '1',
      title: '',
      startDate: '2026-08-01T20:00:00.000Z',
      cityName: 'Köln',
      rawSourceType: 'json_ld',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'TITLE_MISSING')).toBe(true);
  });

  it('rejects end before start', () => {
    const result = importCandidateValidator.validate({
      externalId: '1',
      title: 'Bad Dates',
      startDate: '2026-08-02T20:00:00.000Z',
      endDate: '2026-08-01T20:00:00.000Z',
      cityName: 'Köln',
      rawSourceType: 'json_ld',
    });
    expect(result.errors.some((error) => error.code === 'END_DATE_BEFORE_START')).toBe(true);
  });
});

describe('Orchestrator integration', () => {
  it('stores needs_review and invalid records with metrics', async () => {
    const bundle = createLocalImportDatasourceBundle();
    const registry = new ImportAdapterRegistry();
    registry.register({
      adapterKey: 'mock',
      async execute() {
        return {
          records: [
            {
              externalId: 'valid-1',
              rawPayload: { title: 'Valid' },
              normalizedCandidate: {
                externalId: 'valid-1',
                title: 'Valid',
                startDate: '2026-08-01T20:00:00.000Z',
                cityName: 'Köln',
                rawSourceType: 'unknown',
              },
              status: 'needs_review',
            },
            {
              externalId: 'invalid-1',
              rawPayload: {},
              status: 'invalid',
              validationErrors: [{ code: 'TITLE_MISSING', message: 'missing title' }],
            },
          ],
          warnings: ['one warning'],
          skippedCount: 0,
          metadata: {},
        };
      },
    });

    const orchestrator = new ImportOrchestrator(
      bundle.sources,
      bundle.jobs,
      bundle.records,
      registry,
      new ImportLoggingService(bundle.logs),
    );

    await bundle.sources.save({
      id: 'src',
      name: 'Test',
      type: 'test',
      trustScore: 1,
      active: true,
      adapterKey: 'mock',
    });

    const job = await orchestrator.run('src', 'manual');
    expect(job.status).toBe('completed_with_warnings');
    expect(job.metrics.parsedCount).toBe(1);
    expect(job.metrics.invalidCount).toBe(1);
  });

  it('marks job failed on fetch error', async () => {
    const bundle = createLocalImportDatasourceBundle();
    const registry = new ImportAdapterRegistry();
    registry.register({
      adapterKey: 'fail',
      async execute() {
        throw new Error('Network failure');
      },
    });

    const orchestrator = new ImportOrchestrator(
      bundle.sources,
      bundle.jobs,
      bundle.records,
      registry,
      new ImportLoggingService(bundle.logs),
    );

    await bundle.sources.save({
      id: 'src-fail',
      name: 'Fail',
      type: 'test',
      trustScore: 1,
      active: true,
      adapterKey: 'fail',
    });

    const job = await orchestrator.run('src-fail', 'manual');
    expect(job.status).toBe('failed');
    expect(job.errorSummary).toContain('Network failure');
  });
});
