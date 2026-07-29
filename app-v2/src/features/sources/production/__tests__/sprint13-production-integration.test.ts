import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import {
  createAffenkaefigProductionSourceRecord,
  createBootshausProductionSourceRecord,
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/production-source-records';
import { mapSourceRowToRecord, mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import type { SourceRecord } from '@/data/types/records';

async function saveImportSource(
  bundle: ReturnType<typeof createLocalImportDatasourceBundle>,
  source: SourceRecord,
): Promise<void> {
  await bundle.importSources.save(mapSourceRecordToImportSource(source));
}

function createSprint13Stack() {
  const bundle = createLocalImportDatasourceBundle();
  const loggingService = new ImportLoggingService(bundle.importLogs);
  const multiSource = new InMemoryMultiSourceRepositories();
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

  const consumerEvents: AdminEventRecord[] = [];
  const consumerEventRepository = {
    resolveCanonicalId(id: string) {
      return id;
    },
    getPublishedEvents() {
      return consumerEvents.filter((event) => event.status === 'published');
    },
    getEventById(id: string) {
      return consumerEvents.find((event) => event.id === id);
    },
    async refresh() {
      consumerEvents.length = 0;
      for (const event of adminEvents.filter((entry) => entry.status === 'published')) {
        consumerEvents.push(event);
      }
    },
  } as unknown as EventRepository;

  const publishService = new ImportEventPublishService(
    bundle.importRecords,
    adminEventRepository,
    multiSource.sourceReferences,
    consumerEventRepository,
  );
  const publishDecision = new PublishDecisionService();
  const publishOrchestrator = new ImportPublishOrchestratorService(
    bundle.importRecords,
    publishService,
    publishDecision,
    loggingService,
  );
  const { matchingService } = createImportMatchingService();
  const aggregationService = new ImportAggregationService(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    loggingService,
    adminEventRepository,
    matchingService,
    undefined,
    undefined,
    publishOrchestrator,
  );

  return {
    bundle,
    aggregationService,
    adminEvents,
    consumerEventRepository,
    multiSource,
    publishService,
  };
}

describe('Sprint 13 production sources', () => {
  it('defines Bootshaus with club and venue roles and auto_publish', () => {
    const record = createBootshausProductionSourceRecord();
    expect(record.id).toBe(PRODUCTION_BOOTSHAUS_SOURCE_ID);
    expect(record.sourceRoles).toEqual(['club', 'venue']);
    expect(record.publishMode).toBe('auto_publish');
    expect(record.connectorKey).toBe('club_website');
    expect(record.venueName).toBe('Bootshaus');
    expect(record.organizerId).toBeUndefined();
  });

  it('defines Affenkäfig with organizer and festival roles and auto_publish', () => {
    const record = createAffenkaefigProductionSourceRecord();
    expect(record.id).toBe(PRODUCTION_AFFENKAEFIG_SOURCE_ID);
    expect(record.sourceRoles).toEqual(['organizer', 'festival']);
    expect(record.publishMode).toBe('auto_publish');
    expect(record.connectorKey).toBe('organizer_website');
    expect(record.organizerName).toBe('Affenkäfig');
    expect(record.venueId).toBeUndefined();
  });

  it('maps publish_mode and source_roles from database rows', () => {
    const record = mapSourceRowToRecord({
      id: 'source-bootshaus-koeln',
      slug: 'bootshaus-koeln',
      display_name: 'Bootshaus Köln',
      description: null,
      source_type: 'website',
      base_url: 'https://bootshaus.tv/events/',
      parser_type: 'html',
      acquisition_strategy: 'manual',
      polling_strategy: null,
      polling_interval_minutes: 360,
      rate_limit_per_hour: null,
      priority: 78,
      trust_score: 76,
      requires_authentication: false,
      enabled: true,
      archived: false,
      notes: null,
      name: 'Bootshaus Köln',
      type: 'website',
      website: 'https://bootshaus.tv/events/',
      source_url: 'https://bootshaus.tv/events/',
      source_config: { reference: { connectorKey: 'club_website' } },
      default_timezone: 'Europe/Berlin',
      active: true,
      adapter_key: 'html',
      review_required: false,
      publish_mode: 'auto_publish',
      source_roles: ['club', 'venue'],
      last_error: null,
      last_import_at: null,
      last_job_status: null,
      next_scheduled_at: null,
      country_code: 'DE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(record.publishMode).toBe('auto_publish');
    expect(record.sourceRoles).toEqual(['club', 'venue']);
    expect(record.reviewRequired).toBe(false);
  });
});

describe('Sprint 13 production import pipeline', () => {
  it('auto-publishes Bootshaus fixture events to public.events', async () => {
    const stack = createSprint13Stack();
    const source = createBootshausProductionSourceRecord();
    await saveImportSource(stack.bundle, source);

    const job = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);

    const records = await stack.bundle.importRecords.listByJobId(job.id);
    expect(records.length).toBeGreaterThanOrEqual(3);
    expect(records.every((entry) => entry.status === 'imported')).toBe(true);
    expect(records.every((entry) => entry.resultingEventId)).toBe(true);

    const published = stack.adminEvents.filter((event) => event.status === 'published');
    expect(published.length).toBeGreaterThanOrEqual(3);
    expect(published.every((event) => event.sourceId === PRODUCTION_BOOTSHAUS_SOURCE_ID)).toBe(true);
    expect(stack.consumerEventRepository.getPublishedEvents().length).toBeGreaterThanOrEqual(3);
  });

  it('auto-publishes Affenkäfig fixture events through the same pipeline', async () => {
    const stack = createSprint13Stack();
    const source = createAffenkaefigProductionSourceRecord();
    await saveImportSource(stack.bundle, source);

    const job = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);

    const records = await stack.bundle.importRecords.listByJobId(job.id);
    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(records.every((entry) => entry.status === 'imported')).toBe(true);

    const published = stack.adminEvents.filter((event) => event.status === 'published');
    expect(published.length).toBeGreaterThanOrEqual(2);
    expect(published.some((event) => event.title.includes('Affenkäfig'))).toBe(true);
  });

  it('updates existing events on re-import without duplicates', async () => {
    const stack = createSprint13Stack();
    const source = createAffenkaefigProductionSourceRecord();
    await saveImportSource(stack.bundle, source);

    const firstJob = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    const firstRecords = await stack.bundle.importRecords.listByJobId(firstJob.id);
    const firstCount = stack.adminEvents.length;

    const secondJob = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(secondJob.status).toMatch(/completed/);

    expect(stack.adminEvents.length).toBe(firstCount);
    const secondRecords = await stack.bundle.importRecords.listByJobId(secondJob.id);
    const firstExternalId = firstRecords[0]!.externalId;
    const updated = secondRecords.find((entry) => entry.externalId === firstExternalId);
    expect(updated?.resultingEventId).toBe(firstRecords[0]?.resultingEventId);
  });

  it('writes provenance references for published events', async () => {
    const stack = createSprint13Stack();
    const source = createBootshausProductionSourceRecord();
    await saveImportSource(stack.bundle, source);

    await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    const eventId = stack.adminEvents[0]!.id;
    const references = await stack.multiSource.sourceReferences.findByCanonicalEventId(eventId);
    expect(references.length).toBeGreaterThan(0);
    expect(references[0]?.sourceId).toBe(PRODUCTION_BOOTSHAUS_SOURCE_ID);
  });

  it('queues records for manual_review publish mode', async () => {
    const source = createBootshausProductionSourceRecord({ publishMode: 'manual_review' });
    const publishDecision = new PublishDecisionService();
    const decision = await publishDecision.decide({
      source,
      record: {
        id: 'rec-1',
        importJobId: 'job-1',
        sourceId: source.id,
        externalId: 'ext-1',
        rawPayload: {},
        status: 'needs_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    expect(decision).toBe('queue_for_review');
  });
});
