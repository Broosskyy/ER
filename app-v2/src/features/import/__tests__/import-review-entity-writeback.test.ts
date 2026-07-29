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
import {
  buildEntityCandidateKey,
  EntityResolutionWritebackService,
  InMemoryEntityAliasStore,
} from '@/features/entity-resolution';
import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import type { ImportSource } from '@/features/import/models/types';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { AdminEventRecord } from '@/data/types/records';

const ownerSession: AuthSession = {
  user: { id: 'owner-1', email: 'admin@eternalrave.app' },
  accessToken: 'token',
  role: 'owner',
};

function createTestStack(aliasStore = new InMemoryEntityAliasStore()) {
  const bundle = createLocalImportDatasourceBundle();
  const sourceRepository = bundle.importSources;
  const jobRepository = bundle.importJobs;
  const recordRepository = bundle.importRecords;
  const logRepository = bundle.importLogs;
  const auditRepository = bundle.importAuditLogs;
  const adminRepository = bundle.importAdmin;
  const loggingService = new ImportLoggingService(logRepository);
  const adapterRegistry = new ImportAdapterRegistry();
  const matchingBundle = createImportMatchingService(aliasStore);

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
              sourceId: 'src-1',
              title: 'Test Event',
              startDate: '2026-08-01T20:00:00Z',
              cityName: 'Köln',
              venueName: 'Bootshaus',
              venueAddress: 'Auenweg 173',
              organizerName: 'Boiler Room',
              artistNames: ['Ben Klock'],
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
    matchingBundle.matchingService,
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

  const writebackService = new EntityResolutionWritebackService(aliasStore, async () => undefined);
  const reviewService = new ImportReviewService(
    recordRepository,
    adminRepository,
    eventRepository,
    auditService,
    {
      replaceFromMatchedArtistIds: async () => [],
    },
    undefined,
    matchingBundle.matchingService,
    undefined,
    writebackService,
  );

  return {
    bundle,
    operationsService,
    reviewService,
    recordRepository,
    auditRepository,
    aliasStore,
    savedEvents,
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

describe('Import review entity resolution writeback', () => {
  let stack: ReturnType<typeof createTestStack>;

  beforeEach(() => {
    stack = createTestStack();
  });

  it('persists manual venue match before saving reviewer edits', async () => {
    await seedSource(stack);
    const job = await stack.operationsService.startManualImport(ownerSession, 'src-1');
    const record = await stack.recordRepository.update({
      ...(await stack.recordRepository.listByJobId(job.id))[0]!,
      matchedVenueId: 'venue-auto',
      matchedOrganizerId: 'org-auto',
      matchedArtistIds: ['artist-auto'],
    });

    const updated = await stack.reviewService.editRecord(
      ownerSession,
      record.id,
      { matchedVenueId: 'venue-manual' },
      record.updatedAt,
    );

    expect(updated.reviewerEdits?.matchedVenueId).toBe('venue-manual');
    const candidateKey = buildEntityCandidateKey({
      sourceId: 'src-1',
      name: 'Bootshaus',
      address: 'Auenweg 173',
      city: 'Köln',
    });
    expect(stack.aliasStore.getDecision('venue', candidateKey)?.decision).toBe('manual_override');

    const audits = await stack.auditRepository.listByEntity('import_record', record.id);
    expect(audits.some((entry) => entry.action === 'entity_resolution_decision')).toBe(true);
  });

  it('persists keep_separate decision without updating record on flush failure', async () => {
    const failingStore = new InMemoryEntityAliasStore();
    const failingStack = createTestStack(failingStore);
    const flush = vi.fn(async () => {
      throw new EntityAliasStoreError('database unavailable', { code: 'database_unavailable' });
    });
    const writebackService = new EntityResolutionWritebackService(failingStore, flush);
    const reviewService = new ImportReviewService(
      failingStack.recordRepository,
      failingStack.bundle.importAdmin,
      {
        list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
        getById: async () => null,
        save: async (event: AdminEventRecord) => event,
        delete: async () => undefined,
      },
      new ImportAuditService(failingStack.bundle.importAuditLogs),
      { replaceFromMatchedArtistIds: async () => [] },
      undefined,
      createImportMatchingService(failingStore).matchingService,
      undefined,
      writebackService,
    );

    await seedSource(failingStack);
    const job = await failingStack.operationsService.startManualImport(ownerSession, 'src-1');
    const record = (await failingStack.recordRepository.listByJobId(job.id))[0]!;

    await expect(
      reviewService.editRecord(
        ownerSession,
        record.id,
        { keepSeparateVenue: true },
        record.updatedAt,
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_ENTITY_RESOLUTION_PERSIST_FAILED' });

    const reloaded = await failingStack.recordRepository.getById(record.id);
    expect(reloaded?.reviewerEdits?.keepSeparateVenue).toBeUndefined();
  });

  it('flushes entity decisions before approving and blocks publish on flush failure', async () => {
    const aliasStore = new InMemoryEntityAliasStore();
    const flush = vi.fn(async () => {
      throw new EntityAliasStoreError('persistence failed', { code: 'persistence_failed' });
    });
    const writebackService = new EntityResolutionWritebackService(aliasStore, flush);
    const stackWithFailingFlush = createTestStack(aliasStore);
    const reviewService = new ImportReviewService(
      stackWithFailingFlush.recordRepository,
      stackWithFailingFlush.bundle.importAdmin,
      {
        list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
        getById: async () => null,
        save: async (event: AdminEventRecord) => event,
        delete: async () => undefined,
      },
      new ImportAuditService(stackWithFailingFlush.bundle.importAuditLogs),
      { replaceFromMatchedArtistIds: async () => [] },
      undefined,
      createImportMatchingService(aliasStore).matchingService,
      undefined,
      writebackService,
    );

    await seedSource(stackWithFailingFlush);
    const job = await stackWithFailingFlush.operationsService.startManualImport(ownerSession, 'src-1');
    const record = await stackWithFailingFlush.recordRepository.update({
      ...(await stackWithFailingFlush.recordRepository.listByJobId(job.id))[0]!,
      matchedVenueId: 'venue-auto',
      matchedOrganizerId: 'org-auto',
      matchedArtistIds: ['artist-auto'],
    });

    await expect(
      reviewService.approveRecord(ownerSession, record.id, record.updatedAt),
    ).rejects.toMatchObject({ code: 'IMPORT_ENTITY_RESOLUTION_PERSIST_FAILED' });

    const reloaded = await stackWithFailingFlush.recordRepository.getById(record.id);
    expect(reloaded?.status).toBe('needs_review');
    expect(stackWithFailingFlush.savedEvents).toHaveLength(0);
  });

  it('persists confirmed aliases on approve before creating event', async () => {
    await seedSource(stack);
    const job = await stack.operationsService.startManualImport(ownerSession, 'src-1');
    const record = await stack.recordRepository.update({
      ...(await stack.recordRepository.listByJobId(job.id))[0]!,
      matchedVenueId: 'venue-auto',
      matchedOrganizerId: 'org-auto',
      matchedArtistIds: ['artist-auto'],
    });

    const { record: approved } = await stack.reviewService.approveRecord(
      ownerSession,
      record.id,
      record.updatedAt,
    );

    expect(approved.status).toBe('imported');
    expect(
      stack.aliasStore.findCanonicalId(
        'venue',
        'normalized_name',
        'bootshaus',
        'src-1',
      ),
    ).toBe('venue-auto');

    const audits = await stack.auditRepository.listByEntity('import_record', record.id);
    expect(audits.some((entry) => entry.action === 'entity_resolution_alias')).toBe(true);
    expect(audits.some((entry) => entry.action === 'record_approved')).toBe(true);
  });
});
