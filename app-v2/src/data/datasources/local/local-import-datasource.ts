import type {
  CreateImportJobInput,
  CreateImportLogInput,
  CreateImportRecordInput,
  ImportJob,
  ImportLog,
  ImportRecord,
  ImportSource,
} from '@/features/import/models/types';
import { createEmptyJobMetrics } from '@/features/import/models/types';
import type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from '@/data/datasources/import-types';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface LocalImportStore {
  sources: ImportSource[];
  jobs: ImportJob[];
  records: ImportRecord[];
  logs: ImportLog[];
}

export function createLocalImportStore(): LocalImportStore {
  return {
    sources: [],
    jobs: [],
    records: [],
    logs: [],
  };
}

export function createLocalImportSourceDatasource(store: LocalImportStore): ImportSourceDatasource {
  return {
    async getAll() {
      return [...store.sources];
    },
    async getActive() {
      return store.sources.filter((source) => source.active);
    },
    async getById(id) {
      return store.sources.find((source) => source.id === id) ?? null;
    },
    async save(source) {
      const index = store.sources.findIndex((entry) => entry.id === source.id);
      if (index >= 0) {
        store.sources[index] = source;
      } else {
        store.sources.push(source);
      }
      return source;
    },
  };
}

export function createLocalImportJobDatasource(store: LocalImportStore): ImportJobDatasource {
  return {
    async create(input: CreateImportJobInput) {
      const now = new Date().toISOString();
      const job: ImportJob = {
        id: createId('job'),
        sourceId: input.sourceId,
        status: input.status ?? 'pending',
        triggerType: input.triggerType,
        metrics: createEmptyJobMetrics(),
        createdAt: now,
        updatedAt: now,
      };
      store.jobs.push(job);
      return job;
    },
    async update(job) {
      const index = store.jobs.findIndex((entry) => entry.id === job.id);
      if (index < 0) {
        throw new Error(`Import job "${job.id}" not found.`);
      }
      store.jobs[index] = job;
      return job;
    },
    async getById(id) {
      return store.jobs.find((job) => job.id === id) ?? null;
    },
    async listBySourceId(sourceId) {
      return store.jobs.filter((job) => job.sourceId === sourceId);
    },
  };
}

export function createLocalImportRecordDatasource(store: LocalImportStore): ImportRecordDatasource {
  return {
    async create(input: CreateImportRecordInput) {
      const now = new Date().toISOString();
      const record: ImportRecord = {
        id: createId('record'),
        importJobId: input.importJobId,
        sourceId: input.sourceId,
        externalId: input.externalId,
        sourceUrl: input.sourceUrl,
        rawPayload: input.rawPayload,
        normalizedPayload: input.normalizedPayload,
        validationErrors: input.validationErrors,
        validationWarnings: input.validationWarnings,
        matchedCityId: input.matchedCityId,
        matchedVenueId: input.matchedVenueId,
        matchedArtistIds: input.matchedArtistIds,
        matchedGenreIds: input.matchedGenreIds,
        duplicateEventId: input.duplicateEventId,
        duplicateScore: input.duplicateScore,
        matchingWarnings: input.matchingWarnings,
        status: input.status ?? 'fetched',
        createdAt: now,
        updatedAt: now,
      };
      store.records.push(record);
      return record;
    },
    async createMany(inputs) {
      const records: ImportRecord[] = [];
      for (const input of inputs) {
        records.push(await this.create(input));
      }
      return records;
    },
    async update(record) {
      const index = store.records.findIndex((entry) => entry.id === record.id);
      if (index < 0) {
        throw new Error(`Import record "${record.id}" not found.`);
      }
      store.records[index] = record;
      return record;
    },
    async getById(id) {
      return store.records.find((record) => record.id === id) ?? null;
    },
    async listByJobId(importJobId) {
      return store.records.filter((record) => record.importJobId === importJobId);
    },
  };
}

export function createLocalImportLogDatasource(store: LocalImportStore): ImportLogDatasource {
  return {
    async create(input: CreateImportLogInput) {
      const log: ImportLog = {
        id: createId('log'),
        importJobId: input.importJobId,
        importRecordId: input.importRecordId,
        level: input.level,
        code: input.code,
        message: input.message,
        createdAt: new Date().toISOString(),
      };
      store.logs.push(log);
      return log;
    },
    async listByJobId(importJobId) {
      return store.logs.filter((log) => log.importJobId === importJobId);
    },
  };
}

export function createLocalImportDatasourceBundle(store = createLocalImportStore()) {
  return {
    sources: createLocalImportSourceDatasource(store),
    jobs: createLocalImportJobDatasource(store),
    records: createLocalImportRecordDatasource(store),
    logs: createLocalImportLogDatasource(store),
    store,
  };
}

export type LocalImportDatasourceBundle = ReturnType<typeof createLocalImportDatasourceBundle>;
