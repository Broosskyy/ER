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
} from '@/features/import/models/types';
import type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from './import-types';

export interface ImportAuditLogDatasource {
  create(input: CreateImportAuditLogInput): Promise<ImportAuditLog>;
  listByEntity(entityType: string, entityId: string): Promise<ImportAuditLog[]>;
}

export interface ImportAdminDatasource {
  listJobs(params: ImportJobListParams): Promise<ImportJobListResult>;
  getActiveJobForSource(sourceId: string): Promise<ImportJob | null>;
  listRecords(params: ImportRecordListParams): Promise<ImportRecordListResult>;
  listLogs(params: ImportLogListParams): Promise<ImportLogListResult>;
  getMonitoringStats(): Promise<ImportMonitoringStats>;
  updateIfUnchanged(record: ImportRecord, expectedUpdatedAt: string): Promise<ImportRecord>;
}

export interface ImportDatasourceBundle {
  importSources: ImportSourceDatasource;
  importJobs: ImportJobDatasource;
  importRecords: ImportRecordDatasource;
  importLogs: ImportLogDatasource;
  importAuditLogs: ImportAuditLogDatasource;
  importAdmin: ImportAdminDatasource;
}

export type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from './import-types';
