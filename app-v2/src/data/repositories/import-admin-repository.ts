import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import type {
  CreateImportAuditLogInput,
  ImportAuditLog,
  ImportJob,
  ImportJobListParams,
  ImportJobListResult,
  ImportLog,
  ImportLogListParams,
  ImportLogListResult,
  ImportMonitoringStats,
  ImportRecord,
  ImportRecordListParams,
  ImportRecordListResult,
  ImportSource,
} from '@/features/import/models/types';
import type {
  ImportJobRepository,
  ImportLogRepository,
  ImportRecordRepository,
  ImportSourceRepository,
} from './import-repositories';

export interface ImportAuditLogRepository {
  create(input: CreateImportAuditLogInput): Promise<ImportAuditLog>;
  listByEntity(entityType: string, entityId: string): Promise<ImportAuditLog[]>;
}

export interface ImportAdminRepository {
  listJobs(params: ImportJobListParams): Promise<ImportJobListResult>;
  getActiveJobForSource(sourceId: string): Promise<ImportJob | null>;
  listRecords(params: ImportRecordListParams): Promise<ImportRecordListResult>;
  listLogs(params: ImportLogListParams): Promise<ImportLogListResult>;
  getMonitoringStats(): Promise<ImportMonitoringStats>;
  updateIfUnchanged(record: ImportRecord, expectedUpdatedAt: string): Promise<ImportRecord>;
}

export class ImportAuditLogRepositoryImpl implements ImportAuditLogRepository {
  create(input: CreateImportAuditLogInput): Promise<ImportAuditLog> {
    return getDatasourceBundle().importAuditLogs.create(input);
  }

  listByEntity(entityType: string, entityId: string): Promise<ImportAuditLog[]> {
    return getDatasourceBundle().importAuditLogs.listByEntity(entityType, entityId);
  }
}

export class ImportAdminRepositoryImpl implements ImportAdminRepository {
  listJobs(params: ImportJobListParams): Promise<ImportJobListResult> {
    return getDatasourceBundle().importAdmin.listJobs(params);
  }

  getActiveJobForSource(sourceId: string): Promise<ImportJob | null> {
    return getDatasourceBundle().importAdmin.getActiveJobForSource(sourceId);
  }

  listRecords(params: ImportRecordListParams): Promise<ImportRecordListResult> {
    return getDatasourceBundle().importAdmin.listRecords(params);
  }

  listLogs(params: ImportLogListParams): Promise<ImportLogListResult> {
    return getDatasourceBundle().importAdmin.listLogs(params);
  }

  getMonitoringStats(): Promise<ImportMonitoringStats> {
    return getDatasourceBundle().importAdmin.getMonitoringStats();
  }

  updateIfUnchanged(record: ImportRecord, expectedUpdatedAt: string): Promise<ImportRecord> {
    return getDatasourceBundle().importAdmin.updateIfUnchanged(record, expectedUpdatedAt);
  }
}

export type ImportRepositories = {
  sources: ImportSourceRepository;
  jobs: ImportJobRepository;
  records: ImportRecordRepository;
  logs: ImportLogRepository;
  audit: ImportAuditLogRepository;
  admin: ImportAdminRepository;
};

export function createImportRepositories(): ImportRepositories {
  const bundle = getDatasourceBundle();
  return {
    sources: {
      getAll: () => bundle.importSources.getAll(),
      getActive: () => bundle.importSources.getActive(),
      getById: (id: string) => bundle.importSources.getById(id),
      save: (source: ImportSource) => bundle.importSources.save(source),
    },
    jobs: {
      create: (input) => bundle.importJobs.create(input),
      update: (job) => bundle.importJobs.update(job),
      getById: (id) => bundle.importJobs.getById(id),
      listBySourceId: (sourceId) => bundle.importJobs.listBySourceId(sourceId),
    },
    records: {
      create: (input) => bundle.importRecords.create(input),
      createMany: (inputs) => bundle.importRecords.createMany(inputs),
      update: (record) => bundle.importRecords.update(record),
      getById: (id) => bundle.importRecords.getById(id),
      listByJobId: (importJobId) => bundle.importRecords.listByJobId(importJobId),
      findLatestBySourceAndExternalId: (sourceId, externalId) =>
        bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
      listLatestBySourceId: (sourceId) => bundle.importRecords.listLatestBySourceId(sourceId),
      upsertManyBySourceExternal: (inputs) => bundle.importRecords.upsertManyBySourceExternal(inputs),
    },
    logs: {
      create: (input) => bundle.importLogs.create(input),
      listByJobId: (importJobId) => bundle.importLogs.listByJobId(importJobId),
    },
    audit: new ImportAuditLogRepositoryImpl(),
    admin: new ImportAdminRepositoryImpl(),
  };
}
