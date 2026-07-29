import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import {
  createAffenkaefigProductionSourceRecord,
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
  createBootshausProductionSourceRecord,
} from '@/features/sources/production/production-source-records';
import { resolveConfidenceTier } from '@/features/multi-source-matching/domain/matching-config';

async function saveImportSource(
  bundle: ReturnType<typeof createLocalImportDatasourceBundle>,
  source: ReturnType<typeof createAffenkaefigProductionSourceRecord>,
) {
  await bundle.importSources.save(mapSourceRecordToImportSource(source));
}

function createStack() {
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

  return { bundle, aggregationService, adminEvents, consumerEventRepository };
}

describe('Sprint 28 Affenkäfig integration pipeline', () => {
  it('migration keeps source disabled and removes fixture HTML from DB config', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260760000000_sprint28_affenkaefig_production_connector.sql'),
      'utf8',
    );
    expect(sql).toContain('organizer-affenkaefig');
    expect(sql).toContain("id = 'source-affenkaefig'");
    expect(sql).toContain('enabled = false');
    expect(sql).toContain('manual_review');
    expect(sql).not.toContain('Open Air 2026');
  });

  it('imports fixture events idempotently without duplicates', async () => {
    const stack = createStack();
    const source = createAffenkaefigProductionSourceRecord();
    await saveImportSource(stack.bundle, source);

    const firstJob = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    const firstCount = stack.adminEvents.length;
    expect(firstCount).toBeGreaterThanOrEqual(2);

    const secondJob = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(stack.adminEvents.length).toBe(firstCount);
    expect(secondJob.status).toMatch(/completed/);

    const records = await stack.bundle.importRecords.listByJobId(secondJob.id);
    expect(records.every((entry) => entry.resultingEventId)).toBe(true);
  });

  it('uses canonical confidence tiers only', () => {
    expect(resolveConfidenceTier(95)).toBe('certain');
    expect(resolveConfidenceTier(75)).toBe('probable');
    expect(resolveConfidenceTier(40)).toBe('uncertain');
  });

  it('does not regress Bootshaus fixture import', async () => {
    const stack = createStack();
    const source = createBootshausProductionSourceRecord();
    await saveImportSource(stack.bundle, source);

    const job = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);
    expect(stack.adminEvents.some((event) => event.sourceId === PRODUCTION_BOOTSHAUS_SOURCE_ID)).toBe(true);
    expect(stack.adminEvents.some((event) => event.sourceId === PRODUCTION_AFFENKAEFIG_SOURCE_ID)).toBe(false);
  });
});
