import { describe, expect, it } from 'vitest';

import type { SourceRecord } from '@/data/types/records';
import { resolveSourceCapabilityDeclaration } from '@/features/sources/domain/source-capability-declaration';
import { analyzeFieldCoverage } from '@/features/sources/domain/source-field-coverage-analyzer';
import { detectSourceRegressions } from '@/features/sources/domain/source-regression-detector';
import { buildSourceMergeReliabilityContext } from '@/features/sources/domain/source-reliability-merge-context';
import {
  applyImportReliabilitySnapshot,
  buildImportHealthSnapshot,
  buildSourceReliabilitySummary,
  isFieldSupportedBySource,
} from '@/features/sources/domain/source-reliability-service';
import { priorityBasedMergeStrategy } from '@/features/aggregation/merge/merge-strategy';
import { mapNormalizedCandidateToCanonical } from '@/features/aggregation/domain/canonical-import-event';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

function bootshausSource(): SourceRecord {
  return {
    id: 'source-bootshaus-koeln',
    slug: 'bootshaus-koeln',
    displayName: 'Bootshaus',
    sourceType: 'website',
    connectorKey: 'club_website',
    parserType: 'html',
    acquisitionStrategy: 'scheduled',
    priority: 90,
    trustScore: 85,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    sourceConfig: {
      website: {
        preferredStrategy: 'html',
        limits: { maxDetailPages: 50 },
      },
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function ticketIoSource(): SourceRecord {
  return {
    id: 'source-ticket-io-lehmannclub',
    slug: 'lehmannclub',
    displayName: 'lehmannclub',
    sourceType: 'ticket_platform',
    connectorKey: 'ticket_platform',
    parserType: 'json-ld',
    acquisitionStrategy: 'scheduled',
    priority: 70,
    trustScore: 75,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    sourceConfig: {
      ticketPlatform: {
        shopSlug: 'lehmannclub',
        limits: { maxDetailPages: 0 },
      },
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('source capability declaration', () => {
  it('declares Bootshaus description as supported and price as unsupported', () => {
    const declaration = resolveSourceCapabilityDeclaration(bootshausSource());
    const description = declaration.fieldReliability.find((entry) => entry.field === 'description');
    const price = declaration.fieldReliability.find((entry) => entry.field === 'priceText');

    expect(description?.status).toBe('supported');
    expect(description?.confidence).toBeGreaterThanOrEqual(4);
    expect(price?.status).toBe('unsupported');
  });

  it('declares Ticket.io list ticket URL as highly reliable', () => {
    const declaration = resolveSourceCapabilityDeclaration(ticketIoSource());
    const ticketUrl = declaration.fieldReliability.find((entry) => entry.field === 'ticketUrl');
    const lineup = declaration.fieldReliability.find((entry) => entry.field === 'lineup');

    expect(ticketUrl?.confidence).toBeGreaterThanOrEqual(4);
    expect(lineup?.status).toMatch(/partial|supported/);
  });
});

describe('field coverage analyzer', () => {
  it('computes per-field coverage percentages', () => {
    const report = analyzeFieldCoverage('source-bootshaus-koeln', [
      {
        title: 'Event A',
        description: 'Long description',
        ticketUrl: 'https://tickets.example/a',
      },
      {
        title: 'Event B',
        description: 'Another description',
      },
    ]);

    const description = report.fields.find((field) => field.field === 'description');
    const ticketUrl = report.fields.find((field) => field.field === 'ticketUrl');

    expect(description?.coveragePercent).toBe(100);
    expect(ticketUrl?.coveragePercent).toBe(50);
  });
});

describe('source regression detector', () => {
  it('flags coverage drops only for expected fields', () => {
    const declaration = resolveSourceCapabilityDeclaration(bootshausSource());
    const current = analyzeFieldCoverage('source-bootshaus-koeln', [
      { title: 'Only title' },
      { title: 'Only title 2' },
      { title: 'Only title 3' },
      { title: 'Only title 4' },
      { title: 'Only title 5' },
      { title: 'Only title 6' },
    ]);

    const baseline = analyzeFieldCoverage('source-bootshaus-koeln', Array.from({ length: 10 }, () => ({
      title: 'Event',
      description: 'Rich description',
      ticketUrl: 'https://tickets.example/event',
    })));

    const regressions = detectSourceRegressions({
      sourceId: declaration.sourceId,
      declaration,
      currentFields: current.fields,
      baselineFields: baseline.fields,
    });

    expect(regressions.regressions.some((entry) => entry.field === 'description')).toBe(true);
    expect(regressions.regressions.some((entry) => entry.field === 'priceText')).toBe(false);
  });
});

describe('merge reliability integration', () => {
  it('passes quality and health scores into merge strategy context', () => {
    const context = buildSourceMergeReliabilityContext(bootshausSource());
    expect(context.sourceQualityScore).toBeGreaterThan(0);
    expect(context.sourceHealthScore).toBeGreaterThanOrEqual(0);

    const candidate = mapNormalizedCandidateToCanonical(
      {
        externalId: 'evt-1',
        title: 'Test Event',
        startDate: '2026-08-10T20:00:00.000Z',
        rawSourceType: 'unknown',
      } as NormalizedEventCandidate,
      { id: 'source-bootshaus-koeln', name: 'Bootshaus' },
    );

    const merged = priorityBasedMergeStrategy.merge(candidate, undefined, {
      sourcePriority: 90,
      sourceTrustScore: 85,
      retrievedAt: new Date().toISOString(),
      sourceQualityScore: context.sourceQualityScore,
      sourceHealthScore: context.sourceHealthScore,
    });

    expect(merged.canonicalEvent.title).toBe('Test Event');
  });

  it('treats unsupported fields as expected absences during merge support checks', () => {
    expect(isFieldSupportedBySource(bootshausSource(), 'priceText')).toBe(false);
    expect(isFieldSupportedBySource(ticketIoSource(), 'ticketUrl')).toBe(true);
  });
});

describe('import reliability snapshot', () => {
  it('persists snapshot metadata without losing prior baseline', () => {
    const source = bootshausSource();
    const events = [{ title: 'A', description: 'Desc' }];
    const snapshot = buildImportHealthSnapshot({
      source,
      job: {
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
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      events,
    });

    const updated = applyImportReliabilitySnapshot(source, snapshot);
    const summary = buildSourceReliabilitySummary(updated, events);

    expect(updated.metadata?.reliability).toBeTruthy();
    expect(summary.coverage.totalEvents).toBe(1);
  });
});
