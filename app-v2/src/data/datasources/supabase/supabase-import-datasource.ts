import { AppError } from '@/core/errors/app-error';
import {
  mapImportJobRowToDomain,
  mapImportJobToRow,
  mapImportLogRowToDomain,
  mapImportRecordRowToDomain,
  mapImportRecordToRow,
  mapImportSourceToSourceRow,
  mapSourceRowToImportSource,
  type ImportJobRow,
  type ImportLogRow,
  type ImportRecordRow,
  type SourceRow,
} from '@/data/mappers/import-mapper';
import type {
  CreateImportJobInput,
  CreateImportLogInput,
  CreateImportRecordInput,
  ImportJob,
  ImportRecord,
} from '@/features/import/models/types';
import type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from '@/data/datasources/import-types';
import {
  listLatestImportRecordsBySource,
  upsertImportRecordsBySourceExternal,
} from '@/data/datasources/import-record-upsert';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  createSupabaseImportAdminDatasource,
  createSupabaseImportAuditLogDatasource,
} from './supabase-import-admin-datasource';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

function throwRepositoryError(error: { message: string }): never {
  throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
}

export function createSupabaseImportSourceDatasource(): ImportSourceDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('sources') as SupabaseTable;

  return {
    async getAll() {
      const { data, error } = await table().select('*');
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => mapSourceRowToImportSource(row as SourceRow));
    },
    async getActive() {
      const { data, error } = await table().select('*').eq('active', true);
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => mapSourceRowToImportSource(row as SourceRow));
    },
    async getById(id) {
      const { data, error } = await table().select('*').eq('id', id).maybeSingle();
      if (error) throwRepositoryError(error);
      return data ? mapSourceRowToImportSource(data as SourceRow) : null;
    },
    async save(source) {
      const payload = mapImportSourceToSourceRow(source);
      const { data, error } = await table().upsert(payload).select('*').single();
      if (error) throwRepositoryError(error);
      return mapSourceRowToImportSource(data as SourceRow);
    },
  };
}

export function createSupabaseImportJobDatasource(): ImportJobDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('import_jobs') as SupabaseTable;

  return {
    async create(input: CreateImportJobInput) {
      const now = new Date().toISOString();
      const payload = {
        source_id: input.sourceId,
        status: input.status ?? 'pending',
        trigger_type: input.triggerType,
        triggered_by: input.triggeredBy ?? null,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await table().insert(payload).select('*').single();
      if (error) throwRepositoryError(error);
      return mapImportJobRowToDomain(data as ImportJobRow);
    },
    async update(job: ImportJob) {
      const payload = mapImportJobToRow({ ...job, updatedAt: new Date().toISOString() });
      const { data, error } = await table().update(payload).eq('id', job.id).select('*').single();
      if (error) throwRepositoryError(error);
      return mapImportJobRowToDomain(data as ImportJobRow);
    },
    async getById(id) {
      const { data, error } = await table().select('*').eq('id', id).maybeSingle();
      if (error) throwRepositoryError(error);
      return data ? mapImportJobRowToDomain(data as ImportJobRow) : null;
    },
    async listBySourceId(sourceId) {
      const { data, error } = await table().select('*').eq('source_id', sourceId);
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => mapImportJobRowToDomain(row as ImportJobRow));
    },
  };
}

export function createSupabaseImportRecordDatasource(): ImportRecordDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('import_records') as SupabaseTable;

  const datasource: ImportRecordDatasource = {
    async create(input: CreateImportRecordInput) {
      const now = new Date().toISOString();
      const payload = {
        import_job_id: input.importJobId,
        source_id: input.sourceId,
        external_id: input.externalId,
        source_url: input.sourceUrl ?? null,
        raw_payload: input.rawPayload,
        normalized_payload: input.normalizedPayload ?? null,
        validation_errors: input.validationErrors ?? null,
        validation_warnings: input.validationWarnings ?? null,
        matched_city_id: input.matchedCityId ?? null,
        matched_venue_id: input.matchedVenueId ?? null,
        matched_organizer_id: input.matchedOrganizerId ?? null,
        matched_artist_ids: input.matchedArtistIds ?? [],
        matched_genre_ids: input.matchedGenreIds ?? [],
        duplicate_event_id: input.duplicateEventId ?? null,
        duplicate_score: input.duplicateScore ?? null,
        matching_warnings: input.matchingWarnings ?? null,
        status: input.status ?? 'fetched',
        resulting_event_id: null,
        reviewed_by: null,
        reviewed_at: null,
        reject_reason: null,
        reject_note: null,
        reviewer_edits: null,
        duplicate_decision: null,
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await table().insert(payload).select('*').single();
      if (error) throwRepositoryError(error);
      return mapImportRecordRowToDomain(data as ImportRecordRow);
    },
    async createMany(inputs) {
      if (inputs.length === 0) {
        return [];
      }
      const now = new Date().toISOString();
      const payload = inputs.map((input) => ({
        import_job_id: input.importJobId,
        source_id: input.sourceId,
        external_id: input.externalId,
        source_url: input.sourceUrl ?? null,
        raw_payload: input.rawPayload,
        normalized_payload: input.normalizedPayload ?? null,
        validation_errors: input.validationErrors ?? null,
        validation_warnings: input.validationWarnings ?? null,
        matched_city_id: input.matchedCityId ?? null,
        matched_venue_id: input.matchedVenueId ?? null,
        matched_organizer_id: input.matchedOrganizerId ?? null,
        matched_artist_ids: input.matchedArtistIds ?? [],
        matched_genre_ids: input.matchedGenreIds ?? [],
        duplicate_event_id: input.duplicateEventId ?? null,
        duplicate_score: input.duplicateScore ?? null,
        matching_warnings: input.matchingWarnings ?? null,
        status: input.status ?? 'fetched',
        created_at: now,
        updated_at: now,
      }));
      const { data, error } = await table().insert(payload).select('*');
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => mapImportRecordRowToDomain(row as ImportRecordRow));
    },
    async findLatestBySourceAndExternalId(sourceId, externalId) {
      const { data, error } = await table()
        .select('*')
        .eq('source_id', sourceId)
        .eq('external_id', externalId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throwRepositoryError(error);
      return data ? mapImportRecordRowToDomain(data as ImportRecordRow) : null;
    },
    async listLatestBySourceId(sourceId) {
      const { data, error } = await table()
        .select('*')
        .eq('source_id', sourceId)
        .order('updated_at', { ascending: false });
      if (error) throwRepositoryError(error);
      return listLatestImportRecordsBySource(
        (data ?? []).map((row: unknown) => mapImportRecordRowToDomain(row as ImportRecordRow)),
      );
    },
    async upsertManyBySourceExternal(inputs) {
      return upsertImportRecordsBySourceExternal(inputs, {
        findLatest: (sourceId, externalId) => datasource.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (input) => datasource.create(input),
        update: (record) => datasource.update(record),
      });
    },
    async update(record: ImportRecord) {
      const payload = mapImportRecordToRow({ ...record, updatedAt: new Date().toISOString() });
      const { data, error } = await table().update(payload).eq('id', record.id).select('*').single();
      if (error) throwRepositoryError(error);
      return mapImportRecordRowToDomain(data as ImportRecordRow);
    },
    async getById(id) {
      const { data, error } = await table().select('*').eq('id', id).maybeSingle();
      if (error) throwRepositoryError(error);
      return data ? mapImportRecordRowToDomain(data as ImportRecordRow) : null;
    },
    async listByJobId(importJobId) {
      const { data, error } = await table().select('*').eq('import_job_id', importJobId);
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => mapImportRecordRowToDomain(row as ImportRecordRow));
    },
  };

  return datasource;
}

export function createSupabaseImportLogDatasource(): ImportLogDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('import_logs') as SupabaseTable;

  return {
    async create(input: CreateImportLogInput) {
      const payload = {
        import_job_id: input.importJobId,
        import_record_id: input.importRecordId ?? null,
        level: input.level,
        code: input.code,
        message: input.message,
      };
      const { data, error } = await table().insert(payload).select('*').single();
      if (error) throwRepositoryError(error);
      return mapImportLogRowToDomain(data as ImportLogRow);
    },
    async listByJobId(importJobId) {
      const { data, error } = await table().select('*').eq('import_job_id', importJobId);
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => mapImportLogRowToDomain(row as ImportLogRow));
    },
  };
}

export function createSupabaseImportDatasourceBundle() {
  return {
    importSources: createSupabaseImportSourceDatasource(),
    importJobs: createSupabaseImportJobDatasource(),
    importRecords: createSupabaseImportRecordDatasource(),
    importLogs: createSupabaseImportLogDatasource(),
    importAuditLogs: createSupabaseImportAuditLogDatasource(),
    importAdmin: createSupabaseImportAdminDatasource(),
  };
}
