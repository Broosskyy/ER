import { describe, expect, it } from 'vitest';

import { InMemoryImportReviewQueueRepository } from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import { ImportReviewQueueReconciliationService } from '@/features/trust-quality/services/import-review-queue-reconciliation-service';
import { IMPORT_REVIEW_RESOLUTION_REASONS } from '@/features/trust-quality/domain/trust-quality-types';
import type { ImportRecord } from '@/features/import/models/types';

function buildRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'rec-1',
    importJobId: 'job-1',
    sourceId: 'source-1',
    externalId: 'https://shop.test/event/',
    rawPayload: {},
    status: 'imported',
    resultingEventId: 'evt-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  } as ImportRecord;
}

describe('ImportReviewQueueReconciliationService', () => {
  it('reconciles pending entries for imported records with resulting events', async () => {
    const reviewQueue = new InMemoryImportReviewQueueRepository();
    const record = buildRecord();
    const recordRepo = {
      getById: async (id: string) => (id === record.id ? record : null),
    };
    await reviewQueue.upsert({
      id: 'review-1',
      importRecordId: record.id,
      sourceId: record.sourceId,
      externalEventId: record.externalId,
      status: 'pending',
      decision: 'review_required',
      reasons: ['test'],
      affectedFields: [],
      ruleIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const service = new ImportReviewQueueReconciliationService(reviewQueue, recordRepo);
    const result = await service.reconcileStalePendingEntries();
    expect(result.reconciled).toBe(1);
    const updated = await reviewQueue.findByImportRecordId(record.id);
    expect(updated?.status).toBe('expired');
    expect(updated?.metadata?.resolutionReason).toBe(
      IMPORT_REVIEW_RESOLUTION_REASONS.importedRecordPublished,
    );
  });

  it('preserves genuine needs_review records without resulting events', async () => {
    const reviewQueue = new InMemoryImportReviewQueueRepository();
    const record = buildRecord({ status: 'needs_review', resultingEventId: undefined });
    const recordRepo = {
      getById: async (id: string) => (id === record.id ? record : null),
    };
    await reviewQueue.upsert({
      id: 'review-2',
      importRecordId: record.id,
      sourceId: record.sourceId,
      externalEventId: record.externalId,
      status: 'pending',
      decision: 'review_required',
      reasons: ['uncertain'],
      affectedFields: [],
      ruleIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const service = new ImportReviewQueueReconciliationService(reviewQueue, recordRepo);
    const result = await service.reconcileStalePendingEntries();
    expect(result.preserved).toBe(1);
    expect(result.reconciled).toBe(0);
    const updated = await reviewQueue.findByImportRecordId(record.id);
    expect(updated?.status).toBe('pending');
  });
});
