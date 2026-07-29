import { describe, expect, it } from 'vitest';
import { NormalizeStep } from '@/features/aggregation/pipeline/steps/normalize-step';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { importRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { InMemoryTrustQualityRuleRepository } from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import { applySourceFieldDefaults, resolveSourceFieldDefaults } from '@/features/import/normalization/source-field-defaults';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { upsertImportRecordsBySourceExternal } from '@/data/datasources/import-record-upsert';
import {
  createLocalImportRecordDatasource,
  createLocalImportStore,
} from '@/data/datasources/local/local-import-datasource';

const bootshausSource = createBootshausProductionSourceRecord();
const context: PipelineRunContext = {
  runId: 'run-1',
  source: mapSourceRecordToAggregationSource(bootshausSource),
  triggerType: 'scheduled',
  startedAt: new Date().toISOString(),
};

describe('source field defaults', () => {
  it('resolves Bootshaus defaults from source_config', () => {
    const defaults = resolveSourceFieldDefaults(bootshausSource.sourceConfig, bootshausSource);
    expect(defaults.cityName).toBe('Köln');
    expect(defaults.venueName).toBe('Bootshaus');
    expect(defaults.organizerName).toBe('Bootshaus');
    expect(defaults.cityId).toBe('koeln');
  });

  it('fills missing city, venue, organizer without overriding website values', () => {
    const defaults = resolveSourceFieldDefaults(bootshausSource.sourceConfig, bootshausSource)!;
    const enriched = applySourceFieldDefaults<NormalizedEventCandidate>(
      {
        externalId: 'https://bootshaus.tv/events/test',
        title: 'Test Night',
        startDate: '2026-08-01T22:00:00+02:00',
        venueName: 'Custom Venue',
        eventUrl: 'https://bootshaus.tv/events/test',
        rawSourceType: 'unknown' as const,
      },
      defaults,
    );
    expect(enriched.cityName).toBe('Köln');
    expect(enriched.organizerName).toBe('Bootshaus');
    expect(enriched.venueName).toBe('Custom Venue');
    expect(enriched.ticketUrl).toBe('https://bootshaus.tv/events/test');
  });
});

describe('normalize step Bootshaus defaults', () => {
  it('applies defaults during normalization', async () => {
    const step = new NormalizeStep();
    const result = await step.execute(
      [
        {
          externalId: 'https://bootshaus.tv/events/test-event',
          sourceUrl: 'https://bootshaus.tv/events/test-event',
          rawPayload: {
            title: 'PLAY! Open Air',
            startDate: '2026-08-01T14:00:00+02:00',
            imageUrl: 'https://cdn.example/bootshaus.png',
            eventUrl: 'https://bootshaus.tv/events/test-event',
          },
        },
      ],
      context,
    );

    const event = result.items[0]?.canonicalEvent;
    expect(event?.cityName).toBe('Köln');
    expect(event?.venueName).toBe('Bootshaus');
    expect(event?.organizerName).toBe('Bootshaus');
    expect(event?.ticketUrl).toBe('https://bootshaus.tv/events/test-event');
  });
});

describe('Bootshaus trust quality after defaults', () => {
  it('clears missing city/organizer blockers and reaches auto-publish threshold', async () => {
    const rules = await new InMemoryTrustQualityRuleRepository().listEnabled();
    const record: ImportRecord = {
      id: 'rec-1',
      importJobId: 'job-1',
      sourceId: bootshausSource.id,
      externalId: 'https://bootshaus.tv/events/test-event',
      rawPayload: {},
      normalizedPayload: {
        externalId: 'https://bootshaus.tv/events/test-event',
        title: 'PLAY! Open Air',
        startDate: '2026-08-01T14:00:00+02:00',
        venueName: 'Bootshaus',
        cityName: 'Köln',
        countryCode: 'DE',
        organizerName: 'Bootshaus',
        imageUrl: 'https://cdn.example/bootshaus.png',
        eventUrl: 'https://bootshaus.tv/events/test-event',
        ticketUrl: 'https://bootshaus.tv/events/test-event',
        rawSourceType: 'unknown',
      },
      status: 'needs_review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const quality = importRecordQualityEvaluator.evaluate(record, rules);
    const messages = quality.violations.map((entry) => entry.message);
    expect(messages).not.toContain('City is missing.');
    expect(messages).not.toContain('Organizer is missing.');
    expect(quality.score).toBeGreaterThanOrEqual(65);
  });
});

describe('Bootshaus trust publish decision after defaults', () => {
  it('reaches auto_publish when city and organizer are present', async () => {
    const rules = await new InMemoryTrustQualityRuleRepository().listEnabled();
    const source = createBootshausProductionSourceRecord();
    const record: ImportRecord = {
      id: 'rec-1',
      importJobId: 'job-1',
      sourceId: source.id,
      externalId: 'https://bootshaus.tv/events/test-event',
      rawPayload: {},
      normalizedPayload: {
        externalId: 'https://bootshaus.tv/events/test-event',
        title: 'PLAY! Open Air',
        startDate: '2026-08-01T14:00:00+02:00',
        venueName: 'Bootshaus',
        cityName: 'Köln',
        countryCode: 'DE',
        organizerName: 'Bootshaus',
        imageUrl: 'https://cdn.example/bootshaus.png',
        eventUrl: 'https://bootshaus.tv/events/test-event',
        ticketUrl: 'https://bootshaus.tv/events/test-event',
        rawSourceType: 'unknown',
      },
      status: 'needs_review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { trustPublishDecisionEngine } = await import(
      '@/features/trust-quality/services/trust-publish-decision-engine'
    );
    const evaluation = trustPublishDecisionEngine.evaluate({ source, record, rules });
    expect(evaluation.decision).toBe('auto_publish');
    expect(evaluation.reasons).not.toContain('City is missing.');
    expect(evaluation.reasons).not.toContain('Organizer is missing.');
    expect(evaluation.qualityScore).toBeGreaterThanOrEqual(65);
  });
});

describe('import record upsert idempotency', () => {
  it('reuses existing record for same source external id', async () => {
    const store = createLocalImportStore();
    const datasource = createLocalImportRecordDatasource(store);
    const baseInput = {
      importJobId: 'job-1',
      sourceId: bootshausSource.id,
      externalId: 'https://bootshaus.tv/events/test-event',
      rawPayload: { title: 'A' },
      normalizedPayload: { title: 'A', startDate: '2026-08-01T22:00:00+02:00' },
      status: 'needs_review' as const,
    };

    const first = await datasource.upsertManyBySourceExternal([baseInput]);
    const second = await datasource.upsertManyBySourceExternal([
      { ...baseInput, importJobId: 'job-2', rawPayload: { title: 'A' } },
    ]);

    expect(store.records).toHaveLength(1);
    expect(second[0]?.id).toBe(first[0]?.id);
    expect(second[0]?.importJobId).toBe('job-2');
  });

  it('keeps distinct events on same date separate', async () => {
    const store = createLocalImportStore();
    const datasource = createLocalImportRecordDatasource(store);
    const records = await upsertImportRecordsBySourceExternal(
      [
        {
          importJobId: 'job-1',
          sourceId: bootshausSource.id,
          externalId: 'https://bootshaus.tv/events/a',
          rawPayload: {},
          normalizedPayload: { title: 'Event A', startDate: '2026-08-01T22:00:00+02:00' },
        },
        {
          importJobId: 'job-1',
          sourceId: bootshausSource.id,
          externalId: 'https://bootshaus.tv/events/b',
          rawPayload: {},
          normalizedPayload: { title: 'Event B', startDate: '2026-08-01T23:00:00+02:00' },
        },
      ],
      {
        findLatest: (sourceId, externalId) => datasource.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (input) => datasource.create(input),
        update: (record) => datasource.update(record),
      },
    );
    expect(records).toHaveLength(2);
    expect(store.records).toHaveLength(2);
  });
});
