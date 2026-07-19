import type {
  ImportJob,
  ImportLog,
  ImportRecord,
  ImportSource,
} from '@/features/import/models/types';
import type {
  ImportJobStatus,
  ImportLogLevel,
  ImportRecordStatus,
  ImportTriggerType,
} from '@/features/import/models/statuses';
import type { SourceRecord } from '@/data/types/records';

interface SourceRow {
  id: string;
  name: string;
  type: string;
  website: string | null;
  trust_score: number;
  active: boolean;
  adapter_key: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportJobRow {
  id: string;
  source_id: string;
  status: ImportJobStatus;
  trigger_type: ImportTriggerType;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportRecordRow {
  id: string;
  import_job_id: string;
  source_id: string;
  external_id: string;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown> | null;
  status: ImportRecordStatus;
  created_at: string;
  updated_at: string;
}

interface ImportLogRow {
  id: string;
  import_job_id: string;
  import_record_id: string | null;
  level: ImportLogLevel;
  code: string;
  message: string;
  created_at: string;
}

export function mapSourceRecordToImportSource(record: SourceRecord): ImportSource {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    website: record.website,
    trustScore: record.trustScore,
    active: record.active,
    adapterKey: record.adapterKey,
  };
}

export function mapSourceRowToImportSource(row: SourceRow): ImportSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    website: row.website ?? undefined,
    trustScore: Number(row.trust_score),
    active: row.active,
    adapterKey: row.adapter_key ?? undefined,
  };
}

export function mapImportSourceToSourceRow(source: ImportSource): Record<string, unknown> {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    website: source.website ?? null,
    trust_score: source.trustScore,
    active: source.active,
    adapter_key: source.adapterKey ?? null,
  };
}

export function mapImportJobRowToDomain(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    sourceId: row.source_id,
    status: row.status,
    triggerType: row.trigger_type,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapImportJobToRow(job: ImportJob): Record<string, unknown> {
  return {
    id: job.id,
    source_id: job.sourceId,
    status: job.status,
    trigger_type: job.triggerType,
    started_at: job.startedAt ?? null,
    finished_at: job.finishedAt ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export function mapImportRecordRowToDomain(row: ImportRecordRow): ImportRecord {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    sourceId: row.source_id,
    externalId: row.external_id,
    rawPayload: row.raw_payload,
    normalizedPayload: row.normalized_payload ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapImportRecordToRow(record: ImportRecord): Record<string, unknown> {
  return {
    id: record.id,
    import_job_id: record.importJobId,
    source_id: record.sourceId,
    external_id: record.externalId,
    raw_payload: record.rawPayload,
    normalized_payload: record.normalizedPayload ?? null,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapImportLogRowToDomain(row: ImportLogRow): ImportLog {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    importRecordId: row.import_record_id ?? undefined,
    level: row.level,
    code: row.code,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function mapImportLogToRow(log: ImportLog): Record<string, unknown> {
  return {
    id: log.id,
    import_job_id: log.importJobId,
    import_record_id: log.importRecordId ?? null,
    level: log.level,
    code: log.code,
    message: log.message,
    created_at: log.createdAt,
  };
}

export type {
  SourceRow,
  ImportJobRow,
  ImportRecordRow,
  ImportLogRow,
};
