import { describe, expect, it } from 'vitest';
import { InMemoryImportReviewQueueRepository } from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import type { ImportRecord } from '@/features/import/models/types';
import type { TrustPublishEvaluation } from '@/features/trust-quality/domain/trust-quality-types';

function buildRecord(id: string, jobId: string): ImportRecord {
  return {
    id,
    importJobId: jobId,
    sourceId: 'source-bootshaus-koeln',
    externalId: 'https://bootshaus.tv/events/test-event',
    rawPayload: {},
    normalizedPayload: {
      title: 'PLAY! Open Air',
      startDate: '2026-08-01T14:00:00+02:00',
      venueName: 'Bootshaus',
      cityName: 'Köln',
      organizerName: 'Bootshaus',
    },
    status: 'needs_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildEvaluation(): TrustPublishEvaluation {
  return {
    decision: 'hold',
    qualityScore: 40,
    trustScore: 76,
    reasons: ['Organizer is missing.'],
    affectedFields: ['organizerName'],
    ruleIds: ['rule-missing-organizer'],
    violations: [],
    quality: {
      score: 40,
      tier: 'D',
      completeness: 40,
      missingFields: ['organizer'],
      blockingIssues: [],
      warnings: [],
      violations: [],
      calculatedAt: new Date().toISOString(),
    },
  };
}

describe('import review queue pre-publish idempotency', () => {
  it('updates existing active review instead of creating a duplicate', async () => {
    const repository = new InMemoryImportReviewQueueRepository();
    const service = new ImportReviewQueueService(repository);
    const source = createBootshausProductionSourceRecord();

    const first = await service.enqueueFromEvaluation(buildRecord('rec-1', 'job-1'), source, buildEvaluation(), 'job-1');
    const second = await service.enqueueFromEvaluation(buildRecord('rec-2', 'job-2'), source, buildEvaluation(), 'job-2');

    expect(first?.id).toBeDefined();
    expect(second?.id).toBe(first?.id);
    expect(second?.importRecordId).toBe('rec-2');
    expect(second?.importJobId).toBe('job-2');

    const pending = await service.listPending();
    expect(pending).toHaveLength(1);
  });
});
