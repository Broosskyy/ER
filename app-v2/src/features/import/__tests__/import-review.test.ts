import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import type { ImportSourceAdapter } from '@/features/import/adapters/types';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportOperationsService } from '@/features/import/admin/import-operations-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import { createSourceServiceFromImportStore } from '@/features/sources/services/source-import-bridge';
import type { ImportSource, ImportRecord } from '@/features/import/models/types';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { AdminEventRecord } from '@/data/types/records';

const ownerSession: AuthSession = {
  user: { id: 'owner-1', email: 'admin@eternalrave.app' },
  accessToken: 'token',
  role: 'owner',
};

const viewerSession: AuthSession = {
  user: { id: 'viewer-1', email: 'viewer@test.com' },
  accessToken: 'token',
  role: 'viewer',
};

function createTestStack() {
  const bundle = createLocalImportDatasourceBundle();
  const sourceRepository = bundle.importSources;
  const jobRepository = bundle.importJobs;
  const recordRepository = bundle.importRecords;
  const logRepository = bundle.importLogs;
  const auditRepository = bundle.importAuditLogs;
  const adminRepository = bundle.importAdmin;
  const loggingService = new ImportLoggingService(logRepository);
  const adapterRegistry = new ImportAdapterRegistry();

  const mockAdapter: ImportSourceAdapter = {
    adapterKey: 'rss',
    async execute() {
      return {
        records: [
          {
            externalId: 'ext-1',
            rawPayload: { title: 'Test Event' },
            normalizedCandidate: {
              externalId: 'ext-1',
              title: 'Test Event',
              startDate: '2026-08-01T20:00:00Z',
              cityName: 'Köln',
              venueName: 'Club',
              rawSourceType: 'rss',
            },
            status: 'needs_review',
          },
        ],
        warnings: [],
        skippedCount: 0,
        metadata: {},
      };
    },
  };
  adapterRegistry.register(mockAdapter);

  const orchestrator = new ImportOrchestrator(
    sourceRepository,
    jobRepository,
    recordRepository,
    adapterRegistry,
    loggingService,
  );

  const auditService = new ImportAuditService(auditRepository);
  const sourceService = createSourceServiceFromImportStore(bundle.store);
  const operationsService = new ImportOperationsService(
    sourceRepository,
    sourceService,
    jobRepository,
    adminRepository,
    orchestrator,
    adapterRegistry,
    auditService,
  );

  const savedEvents: AdminEventRecord[] = [];
  const eventRepository = {
    async list() {
      return { items: savedEvents, total: savedEvents.length, page: 1, pageSize: 20 };
    },
    async getById(id: string) {
      return savedEvents.find((e) => e.id === id) ?? null;
    },
    async save(event: AdminEventRecord) {
      savedEvents.push(event);
      return event;
    },
    async delete() {},
  };

  const reviewService = new ImportReviewService(
    recordRepository,
    adminRepository,
    eventRepository,
    auditService,
    {
      replaceFromMatchedArtistIds: async () => [],
    },
  );

  return {
    bundle,
    sourceRepository,
    jobRepository,
    recordRepository,
    auditRepository,
    adminRepository,
    operationsService,
    reviewService,
    savedEvents,
    adapterRegistry,
  };
}

async function seedSource(stack: ReturnType<typeof createTestStack>): Promise<ImportSource> {
  return stack.operationsService.saveSource(
    ownerSession,
    {
      id: 'src-1',
      name: 'Test RSS',
      type: 'feed',
      trustScore: 80,
      active: true,
      adapterKey: 'rss',
      sourceConfig: { feed: { feedUrl: 'https://example.com/feed.xml' } },
    },
    true,
  );
}

describe('Import operations service', () => {
  it('lists sources for viewer', async () => {
    const stack = createTestStack();
    await seedSource(stack);
    const sources = await stack.operationsService.listSources(viewerSession);
    expect(sources).toHaveLength(1);
  });

  it('creates and saves a source', async () => {
    const stack = createTestStack();
    const source = await stack.operationsService.saveSource(
      ownerSession,
      {
        id: 'src-new',
        name: 'New Source',
        type: 'feed',
        trustScore: 50,
        active: false,
        adapterKey: 'rss',
        sourceConfig: { feed: { feedUrl: 'https://example.com/rss' } },
      },
      true,
    );
    expect(source.name).toBe('New Source');
    const audits = await stack.auditRepository.listByEntity('source', source.id);
    expect(audits.some((a) => a.action === 'source_created')).toBe(true);
  });

  it('rejects invalid source config', async () => {
    const stack = createTestStack();
    await expect(
      stack.operationsService.saveSource(
        ownerSession,
        {
          id: 'src-bad',
          name: 'Bad',
          type: 'feed',
          trustScore: 50,
          active: false,
          adapterKey: 'rss',
          sourceConfig: {},
        },
        true,
      ),
    ).rejects.toThrow();
  });

  it('blocks parallel import for same source', async () => {
    const stack = createTestStack();
    const source = await seedSource(stack);
    await stack.jobRepository.create({
      sourceId: source.id,
      triggerType: 'manual',
      status: 'running',
    });
    await expect(
      stack.operationsService.startManualImport(ownerSession, source.id),
    ).rejects.toThrow(/already running/i);
  });

  it('runs manual import and creates records', async () => {
    const stack = createTestStack();
    const source = await seedSource(stack);
    const job = await stack.operationsService.startManualImport(ownerSession, source.id);
    expect(job.status).toMatch(/completed/);
    const records = await stack.recordRepository.listByJobId(job.id);
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe('needs_review');
  });

  it('tests source without persisting records', async () => {
    const stack = createTestStack();
    const source = await seedSource(stack);
    const before = stack.bundle.store.records.length;
    const result = await stack.operationsService.testSource(ownerSession, source.id);
    expect(result.recordCount).toBe(1);
    expect(stack.bundle.store.records.length).toBe(before);
  });

  it('denies import start for viewer', async () => {
    const stack = createTestStack();
    const source = await seedSource(stack);
    await expect(
      stack.operationsService.startManualImport(viewerSession, source.id),
    ).rejects.toThrow(/permission/i);
  });
});

describe('Import review service', () => {
  let stack: ReturnType<typeof createTestStack>;
  let record: ImportRecord;

  beforeEach(async () => {
    stack = createTestStack();
    const source = await seedSource(stack);
    const job = await stack.operationsService.startManualImport(ownerSession, source.id);
    const records = await stack.recordRepository.listByJobId(job.id);
    record = records[0]!;
  });

  it('edits normalized fields without changing raw payload', async () => {
    const rawBefore = JSON.stringify(record.rawPayload);
    const updated = await stack.reviewService.editRecord(
      ownerSession,
      record.id,
      { title: 'Updated Title' },
      record.updatedAt,
    );
    expect(updated.reviewerEdits?.title).toBe('Updated Title');
    expect(JSON.stringify(updated.rawPayload)).toBe(rawBefore);
    const audits = await stack.auditRepository.listByEntity('import_record', record.id);
    expect(audits.some((a) => a.action === 'record_edited')).toBe(true);
  });

  it('approves record and creates draft event', async () => {
    const { record: approved, event } = await stack.reviewService.approveRecord(
      ownerSession,
      record.id,
      record.updatedAt,
    );
    expect(approved.status).toBe('imported');
    expect(approved.resultingEventId).toBe(event.id);
    expect(event.status).toBe('published');
    expect(stack.savedEvents).toHaveLength(1);
  });

  it('rejects record with reason', async () => {
    const rejected = await stack.reviewService.rejectRecord(
      ownerSession,
      record.id,
      'spam',
      'Not relevant',
      record.updatedAt,
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectReason).toBe('spam');
  });

  it('confirms duplicate without creating event', async () => {
    const withDup = await stack.recordRepository.update({
      ...record,
      duplicateEventId: 'existing-evt-1',
      duplicateScore: 90,
      status: 'needs_review',
    });
    const confirmed = await stack.reviewService.confirmDuplicate(
      ownerSession,
      withDup.id,
      'existing-evt-1',
      withDup.updatedAt,
    );
    expect(confirmed.status).toBe('duplicate');
    expect(stack.savedEvents).toHaveLength(0);
  });

  it('detects concurrent modification', async () => {
    await expect(
      stack.reviewService.approveRecord(ownerSession, record.id, 'stale-timestamp'),
    ).rejects.toThrow(/modified/i);
  });

  it('denies approve for viewer', async () => {
    await expect(
      stack.reviewService.approveRecord(viewerSession, record.id, record.updatedAt),
    ).rejects.toThrow(/permission/i);
  });
});

describe('Import admin queries', () => {
  it('paginates review queue', async () => {
    const stack = createTestStack();
    const source = await seedSource(stack);
    const job = await stack.operationsService.startManualImport(ownerSession, source.id);
    const result = await stack.adminRepository.listRecords({ page: 1, pageSize: 10 });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]).toHaveProperty('title');
  });

  it('lists jobs with filters', async () => {
    const stack = createTestStack();
    const source = await seedSource(stack);
    await stack.operationsService.startManualImport(ownerSession, source.id);
    const result = await stack.adminRepository.listJobs({ page: 1, pageSize: 10 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns monitoring stats', async () => {
    const stack = createTestStack();
    await seedSource(stack);
    const stats = await stack.adminRepository.getMonitoringStats();
    expect(stats.activeSources).toBe(1);
  });
});

describe('Admin roles', () => {
  it('viewer cannot write sources', async () => {
    const stack = createTestStack();
    await expect(
      stack.operationsService.saveSource(
        viewerSession,
        {
          id: 'src-x',
          name: 'X',
          type: 'feed',
          trustScore: 1,
          active: false,
          adapterKey: 'rss',
          sourceConfig: { feed: { feedUrl: 'https://example.com' } },
        },
        true,
      ),
    ).rejects.toThrow(/permission/i);
  });
});
