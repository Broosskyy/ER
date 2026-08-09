import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { EventRepository } from '@/data/repositories/repositories';
import type { AdminEventRecord } from '@/data/types/records';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { evaluateGenericTruthPublish } from '@/features/import/generic-truth-pipeline';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { evaluateImportPublishTruthDryRun } from '@/features/import/services/import-event-field-mapper';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';

describe('import entry integration — generic truth dry-run', () => {
  it('runs from publish field mapper through dry-run evaluation', async () => {
    const existing: AdminEventRecord = {
      id: 'evt-integration-001',
      title: 'Integration Fixture',
      description: 'Existing body',
      startDate: '2026-09-01T20:00:00.000Z',
      venueName: 'Example Venue',
      status: 'published',
      sourceId: 'source-bootshaus-koeln',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    const bundle = createLocalImportDatasourceBundle();
    const source = createBootshausProductionSourceRecord();
    await bundle.importSources.save(mapSourceRecordToImportSource(source));

    const loggingService = new ImportLoggingService(bundle.importLogs);
    const multiSource = new InMemoryMultiSourceRepositories();
    const adminEvents: AdminEventRecord[] = [existing];
    const adminEventRepository = {
      async list() {
        return { items: adminEvents, total: adminEvents.length, page: 1, pageSize: 50 };
      },
      async getById(id: string) {
        return adminEvents.find((event) => event.id === id) ?? null;
      },
      async save(event: AdminEventRecord) {
        const index = adminEvents.findIndex((entry) => entry.id === event.id);
        if (index >= 0) adminEvents[index] = event;
        else adminEvents.push(event);
        return event;
      },
      async delete() {},
    };

    const consumerEventRepository = {
      resolveCanonicalId(id: string) {
        return id;
      },
      getPublishedEvents() {
        return adminEvents.filter((e) => e.status === 'published');
      },
      getEventById(id: string) {
        return adminEvents.find((e) => e.id === id);
      },
      async refresh() {},
    } as unknown as EventRepository;

    const publishService = new ImportEventPublishService(
      bundle.importRecords,
      adminEventRepository,
      multiSource.sourceReferences,
      consumerEventRepository,
    );
    const publishOrchestrator = new ImportPublishOrchestratorService(
      bundle.importRecords,
      publishService,
      new PublishDecisionService(),
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

    expect(aggregationService).toBeDefined();

    const candidate = {
      title: 'Integration Fixture',
      startDate: '2026-09-01T20:00:00.000Z',
      description: 'Updated official description with Hardtechno cues',
      venueName: 'Example Venue',
      priceText: 'ab 15,00 €',
      sourceId: source.id,
      sourceName: source.displayName,
      externalId: 'integration-ext-001',
      rawSourceType: 'club_website' as const,
      sourceMetadata: {
        verifiedAt: '2026-08-06T12:00:00.000Z',
        pageTitle: 'Integration Fixture',
        eventDate: '2026-09-01T20:00:00.000Z',
        venueName: 'Example Venue',
      },
    };

    const dryRun = evaluateImportPublishTruthDryRun({ existing, candidate });
    expect(dryRun.eventId).toBe(existing.id);
    expect(dryRun.dryRunBefore).toBeDefined();
    expect(dryRun.dryRunAfter).toBeDefined();

    const publishEval = evaluateGenericTruthPublish({
      existing,
      candidate,
    });
    expect(publishEval.wouldChange).toBeDefined();
    expect(publishEval.writesSuppressed).toBe(true);
  });
});
