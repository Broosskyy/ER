import { AppError } from '@/core/errors/app-error';
import {
  computeMatchConfidence,
  mapImportJobRowToDomain,
  mapImportLogRowToDomain,
  mapImportRecordRowToDomain,
  mapImportRecordToRow,
  mapImportRecordToSummary,
  type ImportJobRow,
  type ImportLogRow,
  type ImportRecordRow,
} from '@/data/mappers/import-mapper';
import type {
  CreateImportAuditLogInput,
  ImportAuditLog,
  ImportJob,
  ImportJobListParams,
  ImportJobListResult,
  ImportLogListParams,
  ImportLogListResult,
  ImportMonitoringStats,
  ImportRecord,
  ImportRecordListParams,
  ImportRecordListResult,
} from '@/features/import/models/types';
import type {
  ImportAdminDatasource,
  ImportAuditLogDatasource,
} from '@/data/datasources/import-admin-types';
import { ImportConcurrencyError } from '@/features/import/errors/import-errors';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

function throwRepositoryError(error: { message: string }): never {
  throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export function createSupabaseImportAuditLogDatasource(): ImportAuditLogDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('import_audit_logs') as SupabaseTable;

  return {
    async create(input: CreateImportAuditLogInput) {
      const payload = {
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        summary: input.summary,
      };
      const { data, error } = await table().insert(payload).select('*').single();
      if (error) throwRepositoryError(error);
      const row = data as {
        id: string;
        actor_id: string;
        action: string;
        entity_type: string;
        entity_id: string;
        summary: string;
        created_at: string;
      };
      return {
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        summary: row.summary,
        createdAt: row.created_at,
      } satisfies ImportAuditLog;
    },
    async listByEntity(entityType, entityId) {
      const { data, error } = await table()
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throwRepositoryError(error);
      return (data ?? []).map((row: unknown) => {
        const entry = row as {
          id: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          summary: string;
          created_at: string;
        };
        return {
          id: entry.id,
          actorId: entry.actor_id,
          action: entry.action,
          entityType: entry.entity_type,
          entityId: entry.entity_id,
          summary: entry.summary,
          createdAt: entry.created_at,
        };
      });
    },
  };
}

export function createSupabaseImportAdminDatasource(): ImportAdminDatasource {
  const supabase = getSupabaseClient();
  const jobsTable = () => supabase.from('import_jobs') as SupabaseTable;
  const recordsTable = () => supabase.from('import_records') as SupabaseTable;
  const logsTable = () => supabase.from('import_logs') as SupabaseTable;
  const sourcesTable = () => supabase.from('sources') as SupabaseTable;

  return {
    async listJobs(params: ImportJobListParams): Promise<ImportJobListResult> {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      let query = jobsTable().select('*', { count: 'exact' });

      if (params.sourceId) query = query.eq('source_id', params.sourceId);
      if (params.status && params.status !== 'all') query = query.eq('status', params.status);
      if (params.triggerType && params.triggerType !== 'all') {
        query = query.eq('trigger_type', params.triggerType);
      }
      if (params.fromDate) query = query.gte('created_at', params.fromDate);
      if (params.toDate) query = query.lte('created_at', params.toDate);

      const sortColumn =
        params.sortBy === 'oldest'
          ? 'created_at'
          : params.sortBy === 'errors'
            ? 'error_count'
            : 'created_at';
      const ascending = params.sortBy === 'oldest';
      query = query.order(sortColumn, { ascending });

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throwRepositoryError(error);

      let jobs = (data ?? []).map((row: unknown) => mapImportJobRowToDomain(row as ImportJobRow));
      if (params.errorsOnly) {
        jobs = jobs.filter(
          (job: ImportJob) =>
            job.status === 'failed' ||
            job.metrics.errorCount > 0 ||
            job.metrics.invalidCount > 0,
        );
      }

      return { items: jobs, total: count ?? jobs.length, page, pageSize };
    },

    async getActiveJobForSource(sourceId: string): Promise<ImportJob | null> {
      const { data, error } = await jobsTable()
        .select('*')
        .eq('source_id', sourceId)
        .in('status', ['pending', 'running'])
        .maybeSingle();
      if (error) throwRepositoryError(error);
      return data ? mapImportJobRowToDomain(data as ImportJobRow) : null;
    },

    async listRecords(params: ImportRecordListParams): Promise<ImportRecordListResult> {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      let query = recordsTable().select('*', { count: 'exact' });

      if (params.importJobId) query = query.eq('import_job_id', params.importJobId);
      if (params.sourceId) query = query.eq('source_id', params.sourceId);

      const statuses = Array.isArray(params.status)
        ? params.status
        : params.status && params.status !== 'all'
          ? [params.status]
          : ['needs_review', 'duplicate'];
      query = query.in('status', statuses);

      const sortColumn =
        params.sortBy === 'duplicateScore'
          ? 'duplicate_score'
          : params.sortBy === 'eventDate'
            ? 'created_at'
            : 'created_at';
      query = query.order(sortColumn, { ascending: false });

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throwRepositoryError(error);

      let records = (data ?? []).map((row: unknown) =>
        mapImportRecordRowToDomain(row as ImportRecordRow),
      );

      if (params.withWarnings) {
        records = records.filter((r: ImportRecord) => r.validationWarnings && r.validationWarnings.length > 0);
      }
      if (params.withoutVenueMatch) {
        records = records.filter((r: ImportRecord) => !r.matchedVenueId);
      }
      if (params.withoutCityMatch) {
        records = records.filter((r: ImportRecord) => !r.matchedCityId);
      }
      if (params.minDuplicateScore !== undefined) {
        records = records.filter((r: ImportRecord) => (r.duplicateScore ?? 0) >= params.minDuplicateScore!);
      }
      if (params.minMatchConfidence !== undefined) {
        records = records.filter(
          (r: ImportRecord) => computeMatchConfidence(r) >= params.minMatchConfidence!,
        );
      }

      if (params.includeRawPayload) {
        return { items: records, total: count ?? records.length, page, pageSize };
      }

      return {
        items: records.map((record: ImportRecord) => mapImportRecordToSummary(record)),
        total: count ?? records.length,
        page,
        pageSize,
      };
    },

    async listLogs(params: ImportLogListParams): Promise<ImportLogListResult> {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 50;
      let query = logsTable()
        .select('*', { count: 'exact' })
        .eq('import_job_id', params.importJobId);

      if (params.level && params.level !== 'all') query = query.eq('level', params.level);
      if (params.code) query = query.ilike('code', `%${params.code}%`);
      if (params.importRecordId) query = query.eq('import_record_id', params.importRecordId);
      if (params.fromDate) query = query.gte('created_at', params.fromDate);
      if (params.toDate) query = query.lte('created_at', params.toDate);

      query = query.order('created_at', { ascending: false });
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throwRepositoryError(error);

      const logs = (data ?? []).map((row: unknown) => mapImportLogRowToDomain(row as ImportLogRow));
      return { items: logs, total: count ?? logs.length, page, pageSize };
    },

    async getMonitoringStats(): Promise<ImportMonitoringStats> {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [sourcesRes, failedJobsRes, reviewRes, invalidRes, dupRes] = await Promise.all([
        sourcesTable().select('id', { count: 'exact', head: true }).eq('active', true),
        jobsTable()
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', dayAgo),
        recordsTable()
          .select('id', { count: 'exact', head: true })
          .eq('status', 'needs_review'),
        recordsTable().select('id', { count: 'exact', head: true }).eq('status', 'invalid'),
        recordsTable().select('id', { count: 'exact', head: true }).eq('status', 'duplicate'),
      ]);

      const { data: recentJobs } = await jobsTable()
        .select('id, source_id, finished_at, status')
        .in('status', ['completed', 'completed_with_warnings'])
        .order('finished_at', { ascending: false })
        .limit(5);

      const sourceIds = [...new Set((recentJobs ?? []).map((j: { source_id: string }) => j.source_id))];
      const { data: sourceRows } =
        sourceIds.length > 0
          ? await sourcesTable().select('id, name').in('id', sourceIds)
          : { data: [] };
      const sourceMap = new Map(
        (sourceRows ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );

      return {
        activeSources: sourcesRes.count ?? 0,
        failedJobsLast24h: failedJobsRes.count ?? 0,
        recordsInReview: reviewRes.count ?? 0,
        invalidRecords: invalidRes.count ?? 0,
        duplicateCandidates: dupRes.count ?? 0,
        averageJobDurationMs: 0,
        lastSuccessfulImports: (recentJobs ?? []).map(
          (job: { id: string; source_id: string; finished_at: string }) => ({
            jobId: job.id,
            sourceId: job.source_id,
            sourceName: sourceMap.get(job.source_id) ?? job.source_id,
            finishedAt: job.finished_at,
          }),
        ),
      };
    },

    async updateIfUnchanged(record: ImportRecord, expectedUpdatedAt: string): Promise<ImportRecord> {
      const payload = mapImportRecordToRow({ ...record, updatedAt: new Date().toISOString() });
      const { data, error } = await recordsTable()
        .update(payload)
        .eq('id', record.id)
        .eq('updated_at', expectedUpdatedAt)
        .select('*')
        .maybeSingle();
      if (error) throwRepositoryError(error);
      if (!data) {
        throw new ImportConcurrencyError();
      }
      return mapImportRecordRowToDomain(data as ImportRecordRow);
    },
  };
}
