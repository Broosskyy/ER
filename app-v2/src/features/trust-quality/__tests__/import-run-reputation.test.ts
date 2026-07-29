import { describe, expect, it } from 'vitest';

import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import { ImportError } from '@/features/import/errors/import-errors';
import { createEmptyJobMetrics } from '@/features/import/models/types';
import {
  buildImportRunReputationSummary,
  classifyImportRunFailure,
  decideImportRunReputation,
} from '@/features/trust-quality/services/import-run-reputation';

describe('import run reputation', () => {
  it('classifies platform connector timeouts separately from source configuration', () => {
    expect(
      classifyImportRunFailure(
        new SourceConnectorError({ code: 'timeout', message: 'timeout', retryable: true }),
      ),
    ).toBe('platform');
    expect(
      classifyImportRunFailure(
        new SourceConnectorError({
          code: 'configuration_invalid',
          message: 'invalid',
          retryable: false,
        }),
      ),
    ).toBe('source_configuration');
  });

  it('does not penalize platform import errors', () => {
    const summary = buildImportRunReputationSummary({
      job: {
        id: 'job-1',
        sourceId: 'source-1',
        status: 'failed',
        triggerType: 'scheduled',
        metrics: createEmptyJobMetrics(),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      failureCategory: 'platform',
      errorMessage: 'timeout',
    });

    expect(decideImportRunReputation(summary).eventType).toBeNull();
  });

  it('records import_failure for source-side failures', () => {
    const summary = buildImportRunReputationSummary({
      job: {
        id: 'job-2',
        sourceId: 'source-1',
        status: 'failed',
        triggerType: 'scheduled',
        metrics: createEmptyJobMetrics(),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      failureCategory: classifyImportRunFailure(
        new ImportError('invalid payload', 'IMPORT_VALIDATION_BLOCKED'),
      ),
      errorMessage: 'invalid payload',
    });

    expect(decideImportRunReputation(summary).eventType).toBe('import_failure');
  });

  it('captures no-records-found as import_success metadata', () => {
    const summary = buildImportRunReputationSummary({
      job: {
        id: 'job-3',
        sourceId: 'source-1',
        status: 'completed',
        triggerType: 'manual',
        metrics: { ...createEmptyJobMetrics(), fetchedCount: 0 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const decision = decideImportRunReputation(summary);
    expect(decision.eventType).toBe('import_success');
    expect(decision.metadata.outcome).toBe('no_records_found');
  });

  it('captures publish and review counters in metadata', () => {
    const summary = buildImportRunReputationSummary({
      job: {
        id: 'job-4',
        sourceId: 'source-1',
        status: 'completed',
        triggerType: 'manual',
        metrics: { ...createEmptyJobMetrics(), fetchedCount: 3, parsedCount: 2, duplicateCount: 1 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      publishResult: {
        publishedCount: 1,
        queuedCount: 1,
        skippedCount: 0,
        rejectedCount: 0,
        heldCount: 0,
      },
    });

    const decision = decideImportRunReputation(summary);
    expect(decision.metadata.autoPublished).toBe(1);
    expect(decision.metadata.movedToReview).toBe(1);
    expect(decision.metadata.duplicatesDetected).toBe(1);
  });
});
