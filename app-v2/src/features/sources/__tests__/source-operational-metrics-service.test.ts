import { describe, expect, it } from 'vitest';

import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { ImportJob } from '@/features/import/models/types';
import type { ImportRecord } from '@/features/import/models/types';
import { SourceOperationalMetricsService } from '@/features/sources/services/source-operational-metrics-service';

function sourceRecord(): SourceRecord {
  return {
    id: 'source-1',
    slug: 'source-1',
    displayName: 'Source',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 70,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('SourceOperationalMetricsService', () => {
  it('skips duplicate finalization for the same import job id', async () => {
    const saved: SourceRecord[] = [];
    const source = sourceRecord();
    const job = {
      id: 'job-1',
      sourceId: source.id,
      status: 'completed',
      triggerType: 'manual',
      metrics: {
        fetchedCount: 1,
        parsedCount: 1,
        invalidCount: 0,
        warningCount: 0,
        errorCount: 0,
        createdCount: 1,
        updatedCount: 0,
        duplicateCount: 0,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      finishedAt: '2026-01-02T00:00:00.000Z',
    } as ImportJob;

    const record = {
      id: 'rec-1',
      importJobId: job.id,
      sourceId: source.id,
      externalId: 'ext-1',
      rawPayload: {},
      status: 'imported',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    } as ImportRecord;

    const service = new SourceOperationalMetricsService(
      {
        getById: async () => source,
        getAll: async () => [source],
        save: async (record) => {
          saved.push(record);
          return record;
        },
      } as never,
      { listLatestBySourceId: async () => [record], listByJobId: async () => [record] } as never,
      { listBySourceId: async () => [job] } as never,
      {
        findBySourceId: async () => [
          {
            id: 'ref-1',
            canonicalEventId: 'evt-1',
            sourceId: source.id,
            externalEventId: 'ext-1',
            firstSeenAt: '2026-01-01T00:00:00.000Z',
            lastSeenAt: '2026-01-02T00:00:00.000Z',
            active: true,
            sourcePriority: 50,
          },
        ],
      } as never,
      {
        getById: async () =>
          ({
            id: 'evt-1',
            title: 'Event',
            description: '',
            startDate: '2026-08-01T20:00:00.000Z',
            status: 'published',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          }) as AdminEventRecord,
      } as never,
    );

    const first = await service.finalizeImportJob(source, job);
    expect(first.updated).toBe(true);
    expect(saved).toHaveLength(1);

    const finalizedSource = {
      ...saved[0]!,
      metadata: { lastFinalizedImportJobId: job.id },
    };
    const second = await service.finalizeImportJob(finalizedSource, job);
    expect(second.skippedDuplicateFinalization).toBe(true);
    expect(saved).toHaveLength(1);
  });
});
