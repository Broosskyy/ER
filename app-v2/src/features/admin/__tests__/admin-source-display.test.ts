import { describe, expect, it } from 'vitest';

import { formatSourceImportSummaryDe, formatConnectorCapabilitySummaryDe } from '@/features/admin/utils/admin-source-display';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import type { SourceRecord } from '@/data/types/records';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-1',
    slug: 'source-1',
    displayName: 'Test Source',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 70,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('formatSourceImportSummaryDe', () => {
  it('formats event count and last import for active sources', () => {
    const summary = formatSourceImportSummaryDe(
      source({
        totalValidEventCount: 12,
        lastImportAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        lastJobStatus: 'completed',
      }),
    );
    expect(summary.eventCountLabel).toBe('12 Events');
    expect(summary.lastImportLabel).toContain('Letzter Import:');
    expect(summary.healthLabel).toContain('Erfolgreich');
  });

  it('shows never imported state for zero events without last import', () => {
    const summary = formatSourceImportSummaryDe(source({ totalValidEventCount: 0 }));
    expect(summary.eventCountLabel).toBe('0 Events');
    expect(summary.lastImportLabel).toBe('Noch kein Import');
  });
});

describe('formatConnectorCapabilitySummaryDe', () => {
  it('reports Bootshaus detail level and quality labels', () => {
    const summary = formatConnectorCapabilitySummaryDe(createBootshausProductionSourceRecord());
    expect(summary.detailLevelLabel).toContain('Stufe 2');
    expect(summary.qualityLabel).toMatch(/\(\d+\)/);
    expect(summary.descriptionCoverage).toContain('Beschreibung');
  });
});
