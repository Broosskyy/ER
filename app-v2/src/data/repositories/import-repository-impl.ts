import { mapSourceRecordToImportSource } from '@/data/mappers/import-mapper';
import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import type {
  CreateImportJobInput,
  CreateImportLogInput,
  CreateImportRecordInput,
  ImportJob,
  ImportLog,
  ImportRecord,
  ImportSource,
} from '@/features/import/models/types';
import type {
  ImportJobRepository,
  ImportLogRepository,
  ImportRecordRepository,
  ImportSourceRepository,
} from './import-repositories';

export class ImportSourceRepositoryImpl implements ImportSourceRepository {
  getAll(): Promise<ImportSource[]> {
    return getDatasourceBundle().importSources.getAll();
  }

  getActive(): Promise<ImportSource[]> {
    return getDatasourceBundle().importSources.getActive();
  }

  getById(id: string): Promise<ImportSource | null> {
    return getDatasourceBundle().importSources.getById(id);
  }

  save(source: ImportSource): Promise<ImportSource> {
    return getDatasourceBundle().importSources.save(source);
  }
}

export class ImportJobRepositoryImpl implements ImportJobRepository {
  create(input: CreateImportJobInput): Promise<ImportJob> {
    return getDatasourceBundle().importJobs.create(input);
  }

  update(job: ImportJob): Promise<ImportJob> {
    return getDatasourceBundle().importJobs.update(job);
  }

  getById(id: string): Promise<ImportJob | null> {
    return getDatasourceBundle().importJobs.getById(id);
  }

  listBySourceId(sourceId: string): Promise<ImportJob[]> {
    return getDatasourceBundle().importJobs.listBySourceId(sourceId);
  }
}

export class ImportRecordRepositoryImpl implements ImportRecordRepository {
  create(input: CreateImportRecordInput): Promise<ImportRecord> {
    return getDatasourceBundle().importRecords.create(input);
  }

  createMany(inputs: CreateImportRecordInput[]): Promise<ImportRecord[]> {
    return getDatasourceBundle().importRecords.createMany(inputs);
  }

  upsertManyBySourceExternal(inputs: CreateImportRecordInput[]): Promise<ImportRecord[]> {
    return getDatasourceBundle().importRecords.upsertManyBySourceExternal(inputs);
  }

  update(record: ImportRecord): Promise<ImportRecord> {
    return getDatasourceBundle().importRecords.update(record);
  }

  getById(id: string): Promise<ImportRecord | null> {
    return getDatasourceBundle().importRecords.getById(id);
  }

  findLatestBySourceAndExternalId(sourceId: string, externalId: string): Promise<ImportRecord | null> {
    return getDatasourceBundle().importRecords.findLatestBySourceAndExternalId(sourceId, externalId);
  }

  listLatestBySourceId(sourceId: string): Promise<ImportRecord[]> {
    return getDatasourceBundle().importRecords.listLatestBySourceId(sourceId);
  }

  listByJobId(importJobId: string): Promise<ImportRecord[]> {
    return getDatasourceBundle().importRecords.listByJobId(importJobId);
  }
}

export class ImportLogRepositoryImpl implements ImportLogRepository {
  create(input: CreateImportLogInput): Promise<ImportLog> {
    return getDatasourceBundle().importLogs.create(input);
  }

  listByJobId(importJobId: string): Promise<ImportLog[]> {
    return getDatasourceBundle().importLogs.listByJobId(importJobId);
  }
}

export function createImportRepositoriesFromBundle(bundle: {
  importSources: ImportSourceRepository;
  importJobs: ImportJobRepository;
  importRecords: ImportRecordRepository;
  importLogs: ImportLogRepository;
}) {
  return bundle;
}

export { mapSourceRecordToImportSource };
