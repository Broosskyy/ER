import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { SourceReference } from '@/features/aggregation/identity/event-identity';
import type { ImportJob } from '@/features/import/models/types';
import type { ImportRecord } from '@/features/import/models/types';
import {
  computeSourceOperationalMetrics,
  metricsChanged,
} from '@/features/sources/domain/source-operational-metrics';

function record(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'rec-1',
    importJobId: 'job-1',
    sourceId: 'source-1',
    externalId: 'ext-1',
    rawPayload: {},
    status: 'imported',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ImportRecord;
}

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'job-1',
    sourceId: 'source-1',
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
    ...overrides,
  } as ImportJob;
}

function origin(canonicalEventId: string, active = true): SourceReference {
  return {
    id: `ref-${canonicalEventId}`,
    canonicalEventId,
    sourceId: 'source-1',
    externalEventId: `https://example.test/${canonicalEventId}`,
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: '2026-01-02T00:00:00.000Z',
    active,
    sourcePriority: 50,
  };
}

function event(id: string, status: AdminEventRecord['status'] = 'published'): AdminEventRecord {
  return {
    id,
    title: `Event ${id}`,
    description: '',
    startDate: '2026-08-01T20:00:00.000Z',
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  } as AdminEventRecord;
}

describe('computeSourceOperationalMetrics', () => {
  it('counts import records, valid origins and latest job metadata', () => {
    const metrics = computeSourceOperationalMetrics({
      importRecords: [record(), record({ id: 'rec-2', status: 'rejected' })],
      importJobs: [
        job({ id: 'job-old', finishedAt: '2026-01-01T00:00:00.000Z' }),
        job({ id: 'job-new', status: 'completed_with_warnings', finishedAt: '2026-01-03T00:00:00.000Z' }),
      ],
      origins: [origin('evt-1'), origin('evt-2')],
      eventsById: new Map([
        ['evt-1', event('evt-1')],
        ['evt-2', event('evt-2')],
      ]),
    });

    expect(metrics.totalImportCount).toBe(2);
    expect(metrics.totalRejectedEventCount).toBe(1);
    expect(metrics.totalValidEventCount).toBe(2);
    expect(metrics.lastImportAt).toBe('2026-01-03T00:00:00.000Z');
    expect(metrics.lastJobStatus).toBe('completed_with_warnings');
    expect(metrics.consecutiveFailureCount).toBe(0);
  });

  it('excludes archived events from valid origin count', () => {
    const metrics = computeSourceOperationalMetrics({
      importRecords: [record()],
      importJobs: [job()],
      origins: [origin('evt-archived')],
      eventsById: new Map([['evt-archived', event('evt-archived', 'archived')]]),
    });
    expect(metrics.totalValidEventCount).toBe(0);
  });

  it('tracks consecutive failures from newest terminal jobs', () => {
    const metrics = computeSourceOperationalMetrics({
      importRecords: [],
      importJobs: [
        job({ id: 'job-3', status: 'failed', finishedAt: '2026-01-04T00:00:00.000Z' }),
        job({ id: 'job-2', status: 'failed', finishedAt: '2026-01-03T00:00:00.000Z' }),
        job({ id: 'job-1', status: 'completed', finishedAt: '2026-01-02T00:00:00.000Z' }),
      ],
      origins: [],
      eventsById: new Map(),
    });
    expect(metrics.consecutiveFailureCount).toBe(2);
    expect(metrics.lastFailedImportAt).toBe('2026-01-04T00:00:00.000Z');
  });
});

describe('metricsChanged', () => {
  it('detects metric differences', () => {
    expect(
      metricsChanged(
        { totalImportCount: 1, totalValidEventCount: 1, totalRejectedEventCount: 0, consecutiveFailureCount: 0 },
        {
          totalImportCount: 2,
          totalValidEventCount: 2,
          totalRejectedEventCount: 0,
          consecutiveFailureCount: 0,
        },
      ),
    ).toBe(true);
  });
});
