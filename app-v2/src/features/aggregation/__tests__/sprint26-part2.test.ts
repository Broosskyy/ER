import { describe, expect, it } from 'vitest';

import { InMemorySourceReputationRepository } from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import { SourceReputationService } from '@/features/trust-quality/services/source-reputation-service';
import { SourceTrustEngine } from '@/features/trust-quality/services/source-trust-engine';
import { buildImportRunReputationSummary } from '@/features/trust-quality/services/import-run-reputation';
import { createEmptyJobMetrics } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import {
  createAffenkaefigProductionSourceRecord,
  createBootshausProductionSourceRecord,
} from '@/features/sources/production/production-source-records';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { resolveSourceConnectorKeyFromRecord } from '@/features/aggregation/connectors/source-connector-resolution';
import { applyWebsiteTitleTransforms } from '@/features/aggregation/connectors/website/title-transforms';
import { BOOTSHAUS_WEBSITE_CONFIG } from '@/features/sources/production/production-source-records';

function adminSourceRepo(initial: SourceRecord) {
  let current = initial;
  return {
    async getById() {
      return current;
    },
    async save(record: SourceRecord) {
      current = record;
      return record;
    },
  };
}

describe('Sprint 26 — reputation integration', () => {
  it('records import reputation only once per job id', async () => {
    const source = createBootshausProductionSourceRecord({ trustScore: 70, computedTrustScore: 70 });
    const reputationRepository = new InMemorySourceReputationRepository();
    const reputationService = new SourceReputationService(
      adminSourceRepo(source) as never,
      reputationRepository,
      new SourceTrustEngine(),
    );

    const summary = buildImportRunReputationSummary({
      job: {
        id: 'job-rep-1',
        sourceId: source.id,
        status: 'completed',
        triggerType: 'manual',
        metrics: { ...createEmptyJobMetrics(), fetchedCount: 2, parsedCount: 2 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      publishResult: {
        publishedCount: 2,
        queuedCount: 0,
        skippedCount: 0,
        rejectedCount: 0,
        heldCount: 0,
      },
    });

    await reputationService.recordImportRunOutcome(source, summary);
    await reputationService.recordImportRunOutcome(source, summary);

    const history = await reputationRepository.listBySourceId(source.id);
    expect(history.filter((entry) => entry.metadata?.importJobId === 'job-rep-1')).toHaveLength(1);
  });
});

describe('Sprint 26 — end-to-end reference sources', () => {
  it('validates Bootshaus connector routing and title transforms', () => {
    const bootshaus = createBootshausProductionSourceRecord();
    expect(resolveSourceConnectorKeyFromRecord(bootshaus)).toBe('club_website');
    expect(
      applyWebsiteTitleTransforms('Night | Bootshaus Club', BOOTSHAUS_WEBSITE_CONFIG.transforms),
    ).toBe('Night');
  });

  it('validates Affenkäfig connector routing and JSON-LD reference mode', async () => {
    const affenkaefig = createAffenkaefigProductionSourceRecord();
    expect(resolveSourceConnectorKeyFromRecord(affenkaefig)).toBe('organizer_website');
    expect(affenkaefig.sourceConfig?.reference?.html).toContain('application/ld+json');

    const bundle = createLocalImportDatasourceBundle();
    const aggregationService = new ImportAggregationService(
      bundle.importSources,
      bundle.importJobs,
      bundle.importRecords,
      new ImportLoggingService(bundle.importLogs),
      {
        async list() {
          return { items: [], total: 0, page: 1, pageSize: 50 };
        },
        async getById() {
          return null;
        },
        async save(record) {
          return record;
        },
        async delete() {},
      },
    );

    const job = await aggregationService.runFromSourceRecord(affenkaefig, 'manual', 'test');
    expect(job.status).toMatch(/completed/);
    expect(job.metrics?.parsedCount).toBeGreaterThan(0);
  });

  it('runs Bootshaus fixture import through aggregation pipeline', async () => {
    const bootshaus = createBootshausProductionSourceRecord();
    const bundle = createLocalImportDatasourceBundle();
    const aggregationService = new ImportAggregationService(
      bundle.importSources,
      bundle.importJobs,
      bundle.importRecords,
      new ImportLoggingService(bundle.importLogs),
      {
        async list() {
          return { items: [], total: 0, page: 1, pageSize: 50 };
        },
        async getById() {
          return null;
        },
        async save(record) {
          return record;
        },
        async delete() {},
      },
    );

    const job = await aggregationService.runFromSourceRecord(bootshaus, 'manual', 'test');
    expect(job.status).toMatch(/completed/);
    expect(job.metrics?.fetchedCount).toBeGreaterThan(0);
  });
});
