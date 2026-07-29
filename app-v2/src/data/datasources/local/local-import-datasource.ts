import type {
  CreateImportAuditLogInput,
  CreateImportJobInput,
  CreateImportLogInput,
  CreateImportRecordInput,
  ImportAuditLog,
  ImportJob,
  ImportJobListParams,
  ImportLog,
  ImportLogListParams,
  ImportMonitoringStats,
  ImportRecord,
  ImportRecordListParams,
  ImportSource,
} from '@/features/import/models/types';
import { createEmptyJobMetrics } from '@/features/import/models/types';
import type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from '@/data/datasources/import-types';
import type {
  ImportAdminDatasource,
  ImportAuditLogDatasource,
} from '@/data/datasources/import-admin-types';
import { ImportConcurrencyError } from '@/features/import/errors/import-errors';
import {
  listLatestImportRecordsBySource,
  upsertImportRecordsBySourceExternal,
} from '@/data/datasources/import-record-upsert';
import {
  getActiveJobForSourceLocal,
  getMonitoringStatsLocal,
  listJobsLocal,
  listLogsLocal,
  listRecordsLocal,
} from './local-import-admin-queries';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface LocalImportStore {
  sources: ImportSource[];
  jobs: ImportJob[];
  records: ImportRecord[];
  logs: ImportLog[];
  auditLogs: ImportAuditLog[];
}

export function createLocalImportStore(): LocalImportStore {
  return {
    sources: [],
    jobs: [],
    records: [],
    logs: [],
    auditLogs: [],
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
        triggeredBy: input.triggeredBy,
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
  const datasource: ImportRecordDatasource = {
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
        matchedOrganizerId: input.matchedOrganizerId,
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
    async findLatestBySourceAndExternalId(sourceId, externalId) {
      const matches = store.records
        .filter((record) => record.sourceId === sourceId && record.externalId === externalId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return matches[0] ?? null;
    },
    async listLatestBySourceId(sourceId) {
      return listLatestImportRecordsBySource(
        store.records.filter((record) => record.sourceId === sourceId),
      );
    },
    async upsertManyBySourceExternal(inputs) {
      return upsertImportRecordsBySourceExternal(inputs, {
        findLatest: (sourceId, externalId) => datasource.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (input) => datasource.create(input),
        update: (record) => datasource.update(record),
      });
    },
    async update(record) {
      const index = store.records.findIndex((entry) => entry.id === record.id);
      if (index < 0) {
        throw new Error(`Import record "${record.id}" not found.`);
      }
      store.records[index] = { ...record, updatedAt: new Date().toISOString() };
      return store.records[index];
    },
    async getById(id) {
      return store.records.find((record) => record.id === id) ?? null;
    },
    async listByJobId(importJobId) {
      return store.records.filter((record) => record.importJobId === importJobId);
    },
  };

  return datasource;
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

export function createLocalImportAuditLogDatasource(
  store: LocalImportStore,
): ImportAuditLogDatasource {
  return {
    async create(input: CreateImportAuditLogInput) {
      const entry: ImportAuditLog = {
        id: createId('audit'),
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        createdAt: new Date().toISOString(),
      };
      store.auditLogs.push(entry);
      return entry;
    },
    async listByEntity(entityType, entityId) {
      return store.auditLogs.filter(
        (entry) => entry.entityType === entityType && entry.entityId === entityId,
      );
    },
  };
}

export function createLocalImportAdminDatasource(store: LocalImportStore): ImportAdminDatasource {
  return {
    listJobs: (params: ImportJobListParams) => Promise.resolve(listJobsLocal(store, params)),
    getActiveJobForSource: (sourceId: string) =>
      Promise.resolve(getActiveJobForSourceLocal(store, sourceId)),
    listRecords: (params: ImportRecordListParams) =>
      Promise.resolve(listRecordsLocal(store, params)),
    listLogs: (params: ImportLogListParams) => Promise.resolve(listLogsLocal(store, params)),
    getMonitoringStats: () => Promise.resolve(getMonitoringStatsLocal(store)),
    async updateIfUnchanged(record, expectedUpdatedAt) {
      const current = store.records.find((entry) => entry.id === record.id);
      if (!current) {
        throw new Error(`Import record "${record.id}" not found.`);
      }
      if (current.updatedAt !== expectedUpdatedAt) {
        throw new ImportConcurrencyError();
      }
      const index = store.records.findIndex((entry) => entry.id === record.id);
      const updated = { ...record, updatedAt: new Date().toISOString() };
      store.records[index] = updated;
      return updated;
    },
  };
}

export function createLocalImportDatasourceBundle(store = createLocalImportStore()) {
  const importSources = createLocalImportSourceDatasource(store);
  const importJobs = createLocalImportJobDatasource(store);
  const importRecords = createLocalImportRecordDatasource(store);
  const importLogs = createLocalImportLogDatasource(store);
  const importAuditLogs = createLocalImportAuditLogDatasource(store);
  const importAdmin = createLocalImportAdminDatasource(store);

  return {
    importSources,
    importJobs,
    importRecords,
    importLogs,
    importAuditLogs,
    importAdmin,
    /** @deprecated Use importSources */
    sources: importSources,
    /** @deprecated Use importJobs */
    jobs: importJobs,
    /** @deprecated Use importRecords */
    records: importRecords,
    /** @deprecated Use importLogs */
    logs: importLogs,
    store,
  };
}

export type LocalImportDatasourceBundle = ReturnType<typeof createLocalImportDatasourceBundle>;
