import { describe, expect, it } from 'vitest';

import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import type { FetchProvider } from '@/features/aggregation/pipeline/steps/fetch-step';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { SourceRecord } from '@/data/types/records';

const sourceRecord: SourceRecord = {
  id: 'source-pipeline',
  slug: 'club-feed',
  displayName: 'Club Feed',
  sourceType: 'website',
  parserType: 'json-ld',
  acquisitionStrategy: 'manual',
  priority: 70,
  trustScore: 60,
  requiresAuthentication: false,
  enabled: true,
  archived: false,
  reviewRequired: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const fetchProvider: FetchProvider = {
  async fetch() {
    return [
      {
        externalId: 'evt-1',
        rawPayload: {
          title: 'Pipeline Event',
          startDate: '2026-08-15T21:00:00+02:00',
          venueName: 'Tresor',
          cityName: 'Berlin',
        },
      },
      {
        externalId: 'evt-2',
        rawPayload: {
          title: 'Invalid Event',
          startDate: '2026-08-16T21:00:00+02:00',
        },
      },
    ];
  },
};

describe('aggregation pipeline', () => {
  it('runs fetch → normalize → validate → duplicate → merge → review → publish', async () => {
    const pipeline = new AggregationPipeline({
      fetchProvider,
      logService: new AggregationLogService(),
    });

    const result = await pipeline.run(
      sourceRecord,
      mapSourceRecordToImportSource(sourceRecord),
      'manual',
      'admin-1',
    );

    expect(result.summary.eventCount).toBe(2);
    expect(result.summary.stepDurations.fetch).toBeGreaterThanOrEqual(0);
    expect(result.summary.stepDurations.normalize).toBeGreaterThanOrEqual(0);
    expect(result.summary.stepDurations.validate).toBeGreaterThanOrEqual(0);
    expect(result.summary.stepDurations.duplicate_check).toBeGreaterThanOrEqual(0);
    expect(result.summary.stepDurations.merge).toBeGreaterThanOrEqual(0);
    expect(result.summary.stepDurations.review).toBeGreaterThanOrEqual(0);
    expect(result.summary.stepDurations.publish).toBeGreaterThanOrEqual(0);

    const valid = result.records.find((record) => record.externalId === 'evt-1');
    const invalid = result.records.find((record) => record.externalId === 'evt-2');

    expect(valid?.status).toBe('pending_review');
    expect(valid?.canonicalEvent?.title).toBe('Pipeline Event');
    expect(invalid?.status).toBe('rejected');
  });
});
