import type {
  CreateImportJobInput,
  CreateImportLogInput,
  CreateImportRecordInput,
  ImportJob,
  ImportLog,
  ImportRecord,
  ImportSource,
} from '@/features/import/models/types';

export interface ImportSourceRepository {
  getAll(): Promise<ImportSource[]>;
  getActive(): Promise<ImportSource[]>;
  getById(id: string): Promise<ImportSource | null>;
  /**
   * Persistence-only. Prefer SourceService for writes so validation runs once.
   * @deprecated Use SourceService.saveFromImportSource for mutations.
   */
  save(source: ImportSource): Promise<ImportSource>;
}

export interface ImportJobRepository {
  create(input: CreateImportJobInput): Promise<ImportJob>;
  update(job: ImportJob): Promise<ImportJob>;
  getById(id: string): Promise<ImportJob | null>;
  listBySourceId(sourceId: string): Promise<ImportJob[]>;
}

export interface ImportRecordRepository {
  create(input: CreateImportRecordInput): Promise<ImportRecord>;
  createMany(inputs: CreateImportRecordInput[]): Promise<ImportRecord[]>;
  update(record: ImportRecord): Promise<ImportRecord>;
  getById(id: string): Promise<ImportRecord | null>;
  listByJobId(importJobId: string): Promise<ImportRecord[]>;
}

export interface ImportLogRepository {
  create(input: CreateImportLogInput): Promise<ImportLog>;
  listByJobId(importJobId: string): Promise<ImportLog[]>;
}
