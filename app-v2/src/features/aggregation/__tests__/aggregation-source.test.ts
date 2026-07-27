import { describe, expect, it } from 'vitest';

import {
  mapSourceRecordToAggregationSource,
  resolveAggregationSourceStatus,
  resolveImportStrategy,
} from '@/features/aggregation/domain/aggregation-source';
import type { SourceRecord } from '@/data/types/records';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-1',
    slug: 'ra-berlin',
    displayName: 'Resident Advisor Berlin',
    sourceType: 'api',
    parserType: 'api',
    acquisitionStrategy: 'scheduled',
    pollingStrategy: 'interval',
    pollingIntervalMinutes: 60,
    priority: 80,
    trustScore: 70,
    requiresAuthentication: true,
    enabled: true,
    archived: false,
    baseUrl: 'https://ra.co/events/de/berlin',
    countryCode: 'DE',
    languageCode: 'de',
    reviewRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('aggregation source model', () => {
  it('maps SourceRecord to AggregationSource with regional and auth metadata', () => {
    const mapped = mapSourceRecordToAggregationSource(
      source({
        sourceConfig: {
          auth: { type: 'api_key', prepared: true, headerName: 'Authorization' },
        },
      }),
    );

    expect(mapped.id).toBe('source-1');
    expect(mapped.name).toBe('Resident Advisor Berlin');
    expect(mapped.countryCode).toBe('DE');
    expect(mapped.languageCode).toBe('de');
    expect(mapped.requiresAuthentication).toBe(true);
    expect(mapped.authPrepared).toBe(true);
    expect(mapped.importStrategy).toBe('scheduled');
  });

  it('resolves source status from enabled and job state', () => {
    expect(resolveAggregationSourceStatus(source())).toBe('active');
    expect(resolveAggregationSourceStatus(source({ enabled: false }))).toBe('inactive');
    expect(resolveAggregationSourceStatus(source({ archived: true }))).toBe('archived');
    expect(resolveAggregationSourceStatus(source({ lastJobStatus: 'failed' }))).toBe('error');
  });

  it('resolves import strategy from acquisition strategy', () => {
    expect(resolveImportStrategy(source())).toBe('scheduled');
    expect(resolveImportStrategy(source({ acquisitionStrategy: 'webhook' }))).toBe('webhook');
    expect(resolveImportStrategy(source({ acquisitionStrategy: 'manual' }))).toBe('manual');
  });
});
