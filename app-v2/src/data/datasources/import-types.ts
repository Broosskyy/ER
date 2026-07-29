import type {
  CreateImportJobInput,
  CreateImportLogInput,
  CreateImportRecordInput,
  ImportJob,
  ImportLog,
  ImportRecord,
  ImportSource,
} from '@/features/import/models/types';

export interface ImportSourceDatasource {
  getAll(): Promise<ImportSource[]>;
  getActive(): Promise<ImportSource[]>;
  getById(id: string): Promise<ImportSource | null>;
  save(source: ImportSource): Promise<ImportSource>;
}

export interface ImportJobDatasource {
  create(input: CreateImportJobInput): Promise<ImportJob>;
  update(job: ImportJob): Promise<ImportJob>;
  getById(id: string): Promise<ImportJob | null>;
  listBySourceId(sourceId: string): Promise<ImportJob[]>;
}

export interface ImportRecordDatasource {
  create(input: CreateImportRecordInput): Promise<ImportRecord>;
  createMany(inputs: CreateImportRecordInput[]): Promise<ImportRecord[]>;
  upsertManyBySourceExternal(inputs: CreateImportRecordInput[]): Promise<ImportRecord[]>;
  update(record: ImportRecord): Promise<ImportRecord>;
  getById(id: string): Promise<ImportRecord | null>;
  findLatestBySourceAndExternalId(sourceId: string, externalId: string): Promise<ImportRecord | null>;
  listLatestBySourceId(sourceId: string): Promise<ImportRecord[]>;
  listByJobId(importJobId: string): Promise<ImportRecord[]>;
}

export interface ImportLogDatasource {
  create(input: CreateImportLogInput): Promise<ImportLog>;
  listByJobId(importJobId: string): Promise<ImportLog[]>;
}
