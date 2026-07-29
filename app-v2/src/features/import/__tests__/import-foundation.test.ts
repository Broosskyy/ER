import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import type { ImportSourceAdapter } from '@/features/import/adapters/types';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import {
  IMPORT_JOB_STATUSES,
  IMPORT_RECORD_STATUSES,
  isImportJobStatus,
  isImportRecordStatus,
} from '@/features/import/models/statuses';
import type { ImportSource } from '@/features/import/models/types';
import { getDatasourceBundle, resetDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';

function createTestImportStack() {
  const bundle = createLocalImportDatasourceBundle();
  const sourceRepository = {
    getAll: () => bundle.sources.getAll(),
    getActive: () => bundle.sources.getActive(),
    getById: (id: string) => bundle.sources.getById(id),
    save: (source: ImportSource) => bundle.sources.save(source),
  };
  const jobRepository = {
    create: (input: Parameters<typeof bundle.jobs.create>[0]) => bundle.jobs.create(input),
    update: (job: Awaited<ReturnType<typeof bundle.jobs.create>>) => bundle.jobs.update(job),
    getById: (id: string) => bundle.jobs.getById(id),
    listBySourceId: (sourceId: string) => bundle.jobs.listBySourceId(sourceId),
  };
  const recordRepository = {
    create: (input: Parameters<typeof bundle.records.create>[0]) => bundle.records.create(input),
    createMany: (inputs: Parameters<typeof bundle.records.createMany>[0]) =>
      bundle.records.createMany(inputs),
    update: (record: Awaited<ReturnType<typeof bundle.records.create>>) =>
      bundle.records.update(record),
    getById: (id: string) => bundle.records.getById(id),
    listByJobId: (importJobId: string) => bundle.records.listByJobId(importJobId),
    findLatestBySourceAndExternalId: (sourceId: string, externalId: string) =>
      bundle.records.findLatestBySourceAndExternalId(sourceId, externalId),
    listLatestBySourceId: (sourceId: string) => bundle.records.listLatestBySourceId(sourceId),
    upsertManyBySourceExternal: (inputs: Parameters<typeof bundle.records.upsertManyBySourceExternal>[0]) =>
      bundle.records.upsertManyBySourceExternal(inputs),
  };
  const logRepository = {
    create: (input: Parameters<typeof bundle.logs.create>[0]) => bundle.logs.create(input),
    listByJobId: (importJobId: string) => bundle.logs.listByJobId(importJobId),
  };
  const loggingService = new ImportLoggingService(logRepository);
  const adapterRegistry = new ImportAdapterRegistry();

  return {
    bundle,
    sourceRepository,
    jobRepository,
    recordRepository,
    logRepository,
    loggingService,
    adapterRegistry,
    orchestrator: new ImportOrchestrator(
      sourceRepository,
      jobRepository,
      recordRepository,
      adapterRegistry,
      loggingService,
    ),
  };
}

describe('Import statuses', () => {
  it('recognizes valid job statuses', () => {
    for (const status of IMPORT_JOB_STATUSES) {
      expect(isImportJobStatus(status)).toBe(true);
    }
    expect(isImportJobStatus('unknown')).toBe(false);
  });

  it('recognizes valid record statuses', () => {
    for (const status of IMPORT_RECORD_STATUSES) {
      expect(isImportRecordStatus(status)).toBe(true);
    }
    expect(isImportRecordStatus('unknown')).toBe(false);
  });
});

describe('ImportAdapterRegistry', () => {
  it('registers and resolves adapters by key', () => {
    const registry = new ImportAdapterRegistry();
    const adapter: ImportSourceAdapter = {
      adapterKey: 'mock',
      async execute() {
        return {
          records: [
            {
              externalId: 'ext-1',
              rawPayload: { title: 'Test' },
              status: 'fetched',
            },
          ],
          warnings: [],
          skippedCount: 0,
          metadata: {},
        };
      },
    };

    registry.register(adapter);
    expect(registry.get('mock')).toBe(adapter);
    expect(registry.has('mock')).toBe(true);
    expect(registry.listKeys()).toEqual(['mock']);
  });

  it('rejects duplicate adapter keys', () => {
    const registry = new ImportAdapterRegistry();
    const adapter: ImportSourceAdapter = {
      adapterKey: 'mock',
      async execute() {
        return { records: [], warnings: [], skippedCount: 0, metadata: {} };
      },
    };
    registry.register(adapter);
    expect(() => registry.register(adapter)).toThrow(/already registered/);
  });

  it('rejects unknown adapter keys', () => {
    const registry = new ImportAdapterRegistry();
    expect(() => registry.get('missing')).toThrow(/No import adapter registered/);
  });
});

describe('Import repositories (local)', () => {
  it('creates and updates import jobs', async () => {
    const { sourceRepository, jobRepository } = createTestImportStack();

    await sourceRepository.save({
      id: 'src-1',
      name: 'Test Source',
      type: 'manual',
      trustScore: 1,
      active: true,
      adapterKey: 'mock',
    });

    const job = await jobRepository.create({
      sourceId: 'src-1',
      triggerType: 'manual',
    });

    expect(job.status).toBe('pending');
    const jobs = await jobRepository.listBySourceId('src-1');
    expect(jobs).toHaveLength(1);

    const completed = await jobRepository.update({
      ...job,
      status: 'completed',
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(completed.status).toBe('completed');
  });

  it('creates import records and logs', async () => {
    const { jobRepository, recordRepository, logRepository } = createTestImportStack();

    const job = await jobRepository.create({
      sourceId: 'src-1',
      triggerType: 'scheduled',
    });

    const record = await recordRepository.create({
      importJobId: job.id,
      sourceId: 'src-1',
      externalId: 'event-1',
      rawPayload: { title: 'Rave Night' },
    });

    expect(record.status).toBe('fetched');

    const log = await logRepository.create({
      importJobId: job.id,
      importRecordId: record.id,
      level: 'info',
      code: 'IMPORT_RECORD_SAVED',
      message: 'Record saved',
    });

    expect(log.importRecordId).toBe(record.id);
    expect(await logRepository.listByJobId(job.id)).toHaveLength(1);
  });
});

describe('ImportOrchestrator', () => {
  it('runs import flow with mock adapter', async () => {
    const stack = createTestImportStack();

    await stack.sourceRepository.save({
      id: 'src-mock',
      name: 'Mock Source',
      type: 'test',
      trustScore: 0.9,
      active: true,
      adapterKey: 'mock',
    });

    stack.adapterRegistry.register({
      adapterKey: 'mock',
      async execute() {
        return {
          records: [
            {
              externalId: 'a',
              rawPayload: { id: 'a', title: 'Event A', startDate: '2026-08-01T20:00:00Z', cityName: 'Köln' },
              normalizedCandidate: {
                externalId: 'a',
                title: 'Event A',
                startDate: '2026-08-01T20:00:00.000Z',
                cityName: 'Köln',
                rawSourceType: 'unknown',
              },
              status: 'needs_review',
            },
            {
              externalId: 'b',
              rawPayload: { id: 'b' },
              status: 'invalid',
              validationErrors: [{ code: 'TITLE_MISSING', message: 'missing' }],
            },
          ],
          warnings: [],
          skippedCount: 0,
          metadata: {},
        };
      },
    });

    const job = await stack.orchestrator.run('src-mock', 'manual');

    expect(job.status).toBe('completed_with_warnings');
    const records = await stack.recordRepository.listByJobId(job.id);
    expect(records).toHaveLength(2);
    expect(records.some((record) => record.status === 'needs_review')).toBe(true);
    expect(records.some((record) => record.status === 'invalid')).toBe(true);

    const logs = await stack.logRepository.listByJobId(job.id);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('marks job failed when adapter throws', async () => {
    const stack = createTestImportStack();

    await stack.sourceRepository.save({
      id: 'src-fail',
      name: 'Failing Source',
      type: 'test',
      trustScore: 0.5,
      active: true,
      adapterKey: 'fail',
    });

    stack.adapterRegistry.register({
      adapterKey: 'fail',
      async execute() {
        throw new Error('Adapter failure');
      },
    });

    const job = await stack.orchestrator.run('src-fail', 'manual');
    expect(job.status).toBe('failed');
  });
});

describe('Datasource bundle includes import layer', () => {
  it('exposes import datasources in local bundle', () => {
    resetDatasourceBundle();
    const bundle = getDatasourceBundle();
    expect(bundle.importJobs).toBeDefined();
    expect(bundle.importRecords).toBeDefined();
    expect(bundle.importLogs).toBeDefined();
    expect(bundle.importSources).toBeDefined();
  });
});
