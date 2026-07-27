import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import type { AuthSession } from '@/services/supabase/auth-service';

const owner: AuthSession = {
  user: { id: 'owner', email: 'admin@eternalrave.app' },
  accessToken: 't',
  role: 'owner',
};

function manualSourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-manual-ref',
    slug: 'manual-reference',
    displayName: 'Manual Reference',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 80,
    trustScore: 90,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function createAggregationStack() {
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

  const consumerEvents: AdminEventRecord[] = [];
  let consumerRefreshed = false;
  const consumerEventRepository = {
    async refresh() {
      consumerRefreshed = true;
      consumerEvents.length = 0;
      consumerEvents.push(...adminEvents.filter((event) => event.status === 'published'));
    },
  } as unknown as EventRepository;

  const consumerState = {
    getPublished: () => consumerEvents,
    wasRefreshed: () => consumerRefreshed,
  };

  const aggregationService = new ImportAggregationService(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    loggingService,
    adminEventRepository,
  );

  const auditService = new ImportAuditService(bundle.importAuditLogs);
  const reviewService = new ImportReviewService(
    bundle.importRecords,
    bundle.importAdmin,
    adminEventRepository,
    auditService,
    { replaceFromMatchedArtistIds: async () => [] },
    consumerEventRepository,
  );

  return {
    bundle,
    aggregationService,
    reviewService,
    adminEvents,
    consumerState,
  };
}

describe('ImportAggregationService', () => {
  it('imports manual reference source through aggregation pipeline', async () => {
    const stack = createAggregationStack();
    const sourceRecord = manualSourceRecord();

    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);
    expect(job.metrics?.parsedCount).toBeGreaterThan(0);

    const records = await stack.bundle.importRecords.listByJobId(job.id);
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((record) => record.status === 'needs_review')).toBe(true);

    const reviewable = records.find((record) => record.status === 'needs_review')!;
    expect(reviewable.normalizedPayload).toBeTruthy();
    expect(reviewable.sourceId).toBe('source-manual-ref');
    expect((reviewable.normalizedPayload as { title?: string }).title).toBeTruthy();
  });

  it('approves imported record and refreshes consumer repository', async () => {
    const stack = createAggregationStack();
    const sourceRecord = manualSourceRecord();
    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    const record = (await stack.bundle.importRecords.listByJobId(job.id)).find(
      (entry) => entry.status === 'needs_review',
    )!;

    const { event } = await stack.reviewService.approveRecord(owner, record.id, record.updatedAt);
    expect(event.status).toBe('published');
    expect(stack.consumerState.wasRefreshed()).toBe(true);
    expect(stack.consumerState.getPublished().some((entry) => entry.id === event.id)).toBe(
      true,
    );
  });

  it('archives events missing from subsequent import runs', async () => {
    const stack = createAggregationStack();
    const sourceRecord = manualSourceRecord({
      sourceConfig: {
        reference: {
          connectorKey: 'manual_reference',
          events: [
            {
              externalId: 'ext-archive-test',
              importId: 'ext-archive-test',
              rawSourceType: 'unknown',
              title: 'Archive Candidate',
              startDate: '2026-12-01T22:00:00.000Z',
              venueName: 'Warehouse',
              cityName: 'Berlin',
              countryCode: 'DE',
            },
          ],
        },
      },
    });

    const firstJob = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    const firstRecord = (await stack.bundle.importRecords.listByJobId(firstJob.id))[0]!;
    const { event } = await stack.reviewService.approveRecord(
      owner,
      firstRecord.id,
      firstRecord.updatedAt,
    );
    expect(event.status).toBe('published');

    const emptySource = manualSourceRecord({
      sourceConfig: { reference: { connectorKey: 'manual_reference', events: [] } },
    });
    await stack.aggregationService.runFromSourceRecord(emptySource, 'manual', 'owner');

    const archived = await stack.adminEvents.find((entry) => entry.id === event.id);
    expect(archived?.status).toBe('archived');
  });
});
