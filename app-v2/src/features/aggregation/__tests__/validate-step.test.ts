import { describe, expect, it } from 'vitest';

import { ValidateStep } from '@/features/aggregation/pipeline/steps/validate-step';
import type { NormalizedImportPayload } from '@/features/aggregation/pipeline/steps/normalize-step';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

const context: PipelineRunContext = {
  runId: 'run-1',
  source: {
    id: 'source-1',
    name: 'CSV Feed',
    slug: 'csv-feed',
    type: 'manual',
    status: 'active',
    priority: 50,
    importStrategy: 'manual',
    parserType: 'csv',
    acquisitionStrategy: 'manual',
    requiresAuthentication: false,
    authPrepared: false,
    reviewRequired: true,
    trustScore: 50,
  } satisfies AggregationSource,
  triggerType: 'manual',
  startedAt: new Date().toISOString(),
};

describe('validate step', () => {
  it('rejects events without required location data', async () => {
    const step = new ValidateStep();
    const payloads: NormalizedImportPayload[] = [
      {
        externalId: 'evt-invalid',
        rawPayload: {},
        warnings: [],
        errors: [],
        canonicalEvent: {
          externalId: 'evt-invalid',
          sourceId: 'source-1',
          sourceName: 'CSV Feed',
          title: 'No Location Event',
          startDate: '2026-08-01T20:00:00.000Z',
          rawSourceType: 'csv',
        },
      },
    ];

    const result = await step.execute(payloads, context);
    expect(result.items[0]?.valid).toBe(false);
    expect(result.items[0]?.validationErrors.some((issue) => issue.code === 'LOCATION_MISSING')).toBe(
      true,
    );
  });

  it('accepts events with complete required fields', async () => {
    const step = new ValidateStep();
    const payloads: NormalizedImportPayload[] = [
      {
        externalId: 'evt-valid',
        rawPayload: {},
        warnings: [],
        errors: [],
        canonicalEvent: {
          externalId: 'evt-valid',
          sourceId: 'source-1',
          sourceName: 'CSV Feed',
          title: 'Valid Event',
          startDate: '2026-08-01T20:00:00.000Z',
          venueName: 'Club',
          cityName: 'Berlin',
          rawSourceType: 'csv',
        },
      },
    ];

    const result = await step.execute(payloads, context);
    expect(result.items[0]?.valid).toBe(true);
  });
});
