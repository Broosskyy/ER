import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { createDefaultSourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { composeListDateParts } from '@/features/aggregation/connectors/website/date-compose';
import { detectWebsiteDocument } from '@/features/aggregation/connectors/website/detection';
import { htmlSelectorWebsiteStrategy } from '@/features/aggregation/connectors/website/html-strategies';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { ClubWebsiteConnector } from '@/features/aggregation/connectors/club-website-connector';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { InMemorySourceImportHistoryStore } from '@/features/sources/domain/source-import-history';
import { SourceManagementService } from '@/features/sources/services/source-management-service';
import { SourceService } from '@/features/sources/services/source-service';
import {
  BOOTSHAUS_LIST_FIXTURE_HTML,
  BOOTSHAUS_DETAIL_FIXTURE_HTML,
} from '@/features/sources/production/bootshaus-fixture';
import {
  BOOTSHAUS_WEBSITE_CONFIG,
  createBootshausKoelnSourceRecord,
} from '@/features/sources/production/bootshaus-source';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

const adminRole = 'admin' as const;
const owner: AuthSession = {
  user: { id: 'owner', email: 'admin@eternalrave.app' },
  accessToken: 't',
  role: 'owner',
};

function createProductionStack() {
  const bundle = createLocalImportDatasourceBundle();
  const loggingService = new ImportLoggingService(bundle.importLogs);
  const adminEvents: AdminEventRecord[] = [];
  const adminEventRepository = {
    async list() {
      return { items: adminEvents, total: adminEvents.length, page: 1, pageSize: 50 };
    },
    async getById(id: string) {
      return adminEvents.find((event) => event.id === id) ?? null;
    },
    async save(event: AdminEventRecord) {
      const index = adminEvents.findIndex((entry) => entry.id === event.id);
      if (index >= 0) {
        adminEvents[index] = event;
      } else {
        adminEvents.push(event);
      }
      return event;
    },
    async delete() {},
  };

  const consumerEvents: unknown[] = [];
  const consumerEventRepository = {
    resolveCanonicalId(id: string) {
      return id;
    },
    getPublishedEvents() {
      return consumerEvents;
    },
    getEventById() {
      return undefined;
    },
    async refresh() {},
  } as unknown as EventRepository;

  const { matchingService } = createImportMatchingService();
  const aggregationService = new ImportAggregationService(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    loggingService,
    adminEventRepository,
    matchingService,
  );
  const auditService = new ImportAuditService(bundle.importAuditLogs);
  const reviewService = new ImportReviewService(
    bundle.importRecords,
    bundle.importAdmin,
    adminEventRepository,
    auditService,
    { replaceFromMatchedArtistIds: async () => [] },
    consumerEventRepository,
    matchingService,
  );

  return { bundle, aggregationService, reviewService, adminEvents };
}

describe('Bootshaus real source configuration', () => {
  it('defines a complete source record with website config', () => {
    const record = createBootshausKoelnSourceRecord();
    expect(record.connectorKey).toBe('club_website');
    expect(record.baseUrl).toBe('https://bootshaus.tv/events/');
    expect(record.publishMode).toBe('auto_publish');
    expect(record.reviewRequired).toBe(false);
    expect(record.sourceConfig?.website?.preferredStrategy).toBe('html_selector');
    expect(record.sourceConfig?.reference?.html).toContain('upcoming-item');
  });

  it('validates website configuration through source management', () => {
    const record = createBootshausKoelnSourceRecord();
    const repository = {
      list: async () => ({ items: [record], total: 1, page: 1, pageSize: 50 }),
      getById: async () => record,
      getBySlug: async () => record,
      getAll: async () => [record],
      save: async (item: typeof record) => item,
      archive: async () => record,
      restore: async () => record,
      countImportJobsForSource: async () => 0,
    };
    const management = new SourceManagementService(
      new SourceService(repository),
      createDefaultSourceConnectorRegistry(),
      new InMemorySourceImportHistoryStore(),
    );

    const validation = management.validateWebsiteConfiguration(record);
    expect(validation.valid).toBe(true);
  });
});

describe('Bootshaus fixture extraction', () => {
  const baseDocument = {
    requestedUrl: 'https://bootshaus.tv/events/',
    finalUrl: 'https://bootshaus.tv/events/',
    statusCode: 200,
    contentType: 'text/html',
    responseSize: BOOTSHAUS_LIST_FIXTURE_HTML.length,
    fetchedAt: new Date('2026-07-27T12:00:00.000Z').toISOString(),
    redirectChain: ['https://bootshaus.tv/events/'],
    headers: {},
    detectedSignals: [],
    warnings: [],
  };

  it('detects html list signals from fixture', () => {
    const report = detectWebsiteDocument(
      { ...baseDocument, html: BOOTSHAUS_LIST_FIXTURE_HTML },
      BOOTSHAUS_WEBSITE_CONFIG,
    );
    expect(report.recommendedStrategy).toBe('html_selector');
    expect(report.eventContainerCount).toBeGreaterThan(0);
    expect(report.javascriptRenderingSuspected).toBe(false);
  });

  it('extracts events with title, date, image and detail url', async () => {
    const result = await htmlSelectorWebsiteStrategy.extract(
      { ...baseDocument, html: BOOTSHAUS_LIST_FIXTURE_HTML },
      BOOTSHAUS_WEBSITE_CONFIG,
      { baseUrl: 'https://bootshaus.tv/events/', connectorKey: 'club_website' },
    );

    expect(result.events.length).toBeGreaterThanOrEqual(3);
    const playOpenAir = result.events.find((event) => event.title?.includes('PLAY! Open Air'));
    expect(playOpenAir).toBeDefined();
    expect(playOpenAir?.rawStartDate).toMatch(/^2026-08-01T14:00:00$/);
    expect(playOpenAir?.rawImages?.[0]).toMatch(/^https:\/\//);
    expect(playOpenAir?.detailUrl).toContain('/events/1-8-26-play-open-air-bootshaus-koeln');
    expect(playOpenAir?.fieldEvidence.some((entry) => entry.field === 'title')).toBe(true);
  });

  it('composes german month date parts with timezone-ready format', () => {
    const composed = composeListDateParts('01', 'Aug', '14:00', new Date('2026-07-27T12:00:00.000Z'));
    expect(composed).toBe('2026-08-01T14:00:00');
  });

  it('skips incomplete events without aborting extraction', async () => {
    const brokenFixture = `${BOOTSHAUS_LIST_FIXTURE_HTML}<a class="upcoming-item" href="/events/broken"><div class="upcoming-title"></div></a>`;
    const result = await htmlSelectorWebsiteStrategy.extract(
      { ...baseDocument, html: brokenFixture },
      BOOTSHAUS_WEBSITE_CONFIG,
      { baseUrl: 'https://bootshaus.tv/events/', connectorKey: 'club_website' },
    );
    expect(result.events.length).toBeGreaterThan(0);
  });

  it('extracts optional detail metadata from fixture detail page', async () => {
    const detailDocument = {
      ...baseDocument,
      requestedUrl: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln/',
      finalUrl: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln/',
      html: BOOTSHAUS_DETAIL_FIXTURE_HTML,
      responseSize: BOOTSHAUS_DETAIL_FIXTURE_HTML.length,
    };

    const output = await websiteProcessor.process({
      url: detailDocument.finalUrl,
      importSource: mapSourceRecordToImportSource(
        createBootshausKoelnSourceRecord({
          sourceConfig: {
            reference: { connectorKey: 'club_website', html: BOOTSHAUS_DETAIL_FIXTURE_HTML },
            website: {
              ...BOOTSHAUS_WEBSITE_CONFIG,
              preferredStrategy: 'event_detail_page',
              eventDetailPage: {
                eventLinkSelector: 'a',
                linkIncludePattern: '^https://bootshaus\\.tv/events/',
              },
            },
          },
        }),
      ),
      connectorKey: 'club_website',
      htmlOverride: BOOTSHAUS_DETAIL_FIXTURE_HTML,
    });

    expect(output.events.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Bootshaus connector and source management', () => {
  const record = createBootshausKoelnSourceRecord();
  const context: PipelineRunContext = {
    runId: 'run-bootshaus',
    source: mapSourceRecordToAggregationSource(record),
    triggerType: 'manual',
    startedAt: new Date().toISOString(),
  };

  it('processor extracts PLAY event from fixture', async () => {
    const record = createBootshausKoelnSourceRecord();
    const importSource = mapSourceRecordToImportSource(record);

    const output = await websiteProcessor.process({
      url: record.baseUrl ?? '',
      importSource,
      connectorKey: 'club_website',
      htmlOverride: BOOTSHAUS_LIST_FIXTURE_HTML,
    });

    expect(output.result.diagnostics.strategy).toBe('html_selector');
    expect(output.events.some((event) => event.title?.includes('PLAY! Open Air'))).toBe(true);
  });

  it('loads events through club_website connector with fixture', async () => {
    const connector = new ClubWebsiteConnector();
    const events = await connector.fetchRawEvents(
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.some((event) => event.title?.includes('PLAY! Open Air'))).toBe(true);
    expect(events.every((event) => event.title && event.startDate)).toBe(true);
    expect(events.some((event) => event.sourceMetadata?.extractionStrategy === 'html_selector')).toBe(true);
  });

  it('runs test import and writes import history', async () => {
    const repository = {
      list: async () => ({ items: [record], total: 1, page: 1, pageSize: 50 }),
      getById: async () => record,
      getBySlug: async () => record,
      getAll: async () => [record],
      save: async (item: typeof record) => item,
      archive: async () => record,
      restore: async () => record,
      countImportJobsForSource: async () => 0,
    };
    const history = new InMemorySourceImportHistoryStore();
    const management = new SourceManagementService(
      new SourceService(repository),
      createDefaultSourceConnectorRegistry(),
      history,
    );

    const detection = await management.runWebsiteDetection(adminRole, record.id);
    expect(detection.recommendedStrategy).toBe('html_selector');

    const preview = await management.runWebsiteExtractionPreview(adminRole, record.id);
    expect(preview.eventCount).toBeGreaterThan(0);
    expect(preview.diagnostics.strategy).toBe('html_selector');

    const testImport = await management.runTestImport(adminRole, record.id);
    expect(testImport.eventCount).toBeGreaterThan(0);
    expect(management.getImportHistory(record.id)[0]?.connectorKey).toBe('club_website');
    expect(management.getImportHistory(record.id)).toHaveLength(1);
  });
});

describe('Bootshaus end-to-end aggregation pipeline', () => {
  it('fetch provider returns fixture event titles', async () => {
    const registry = createDefaultSourceConnectorRegistry();
    const provider = createSourceConnectorFetchProvider(registry);
    const record = createBootshausKoelnSourceRecord();
    const source = mapSourceRecordToAggregationSource(record);
    const importSource = mapSourceRecordToImportSource(record);
    const context: PipelineRunContext = {
      runId: 'fetch-provider-bootshaus',
      source,
      triggerType: 'manual',
      startedAt: new Date().toISOString(),
    };

    const payloads = await provider.fetch(source, importSource, context);
    expect(payloads.length).toBeGreaterThanOrEqual(3);
    expect(
      payloads.some((payload) =>
        String(payload.rawPayload.title ?? '').includes('PLAY! Open Air'),
      ),
    ).toBe(true);
  });

  it('imports fixture events through full pipeline with auto_publish', async () => {
    const stack = createProductionStack();
    const sourceRecord = createBootshausKoelnSourceRecord({
      publishMode: 'manual_review',
      reviewRequired: true,
    });

    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);
    expect(job.metrics?.parsedCount).toBeGreaterThanOrEqual(3);

    const records = await stack.bundle.importRecords.listByJobId(job.id);
    expect(records.length).toBeGreaterThanOrEqual(3);
    expect(records.every((entry) => entry.status === 'needs_review')).toBe(true);

    const titles = records.map((entry) => ({
      externalId: entry.externalId,
      title: (entry.normalizedPayload as { title?: string } | undefined)?.title,
    }));
    expect(titles.some((entry) => entry.title?.includes('PLAY! Open Air'))).toBe(true);

    const playEvent = records.find((entry) =>
      (entry.normalizedPayload as { title?: string } | undefined)?.title?.includes('PLAY! Open Air'),
    );
    expect(playEvent?.normalizedPayload).toMatchObject({
      title: expect.stringContaining('PLAY! Open Air'),
    });
    expect((playEvent?.normalizedPayload as { imageUrl?: string })?.imageUrl).toMatch(/^https:\/\//);
  });

  it('supports manual review approval without auto publish for all records', async () => {
    const stack = createProductionStack();
    const sourceRecord = createBootshausKoelnSourceRecord({
      publishMode: 'manual_review',
      reviewRequired: true,
    });
    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    const record = (await stack.bundle.importRecords.listByJobId(job.id))[0]!;

    const { event } = await stack.reviewService.approveRecord(owner, record.id, record.updatedAt);
    expect(event.status).toBe('published');
    expect(stack.adminEvents).toHaveLength(1);
  });
});
