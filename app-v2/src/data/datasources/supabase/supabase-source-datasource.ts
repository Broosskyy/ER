import { AppError } from '@/core/errors/app-error';
import type { SourceRecord, SourceListParams, PaginatedResult } from '@/data/types/records';
import type { SourceDatasource } from '@/data/datasources/types';
import {
  applySourceListParams,
  mapSourceRecordToRow,
  mapSourceRowToRecord,
  type SourceRow,
} from '@/data/mappers/source-mapper';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

export function createSupabaseSourceDatasource(): SourceDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('sources') as SupabaseTable;
  const importJobsTable = () => supabase.from('import_jobs') as SupabaseTable;

  async function fetchAllRows(): Promise<SourceRecord[]> {
    const { data, error } = await table().select('*');
    if (error) {
      throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
    }
    return (data ?? []).map((row: SourceRow) => mapSourceRowToRecord(row));
  }

  return {
    async getAll() {
      return fetchAllRows();
    },
    async getActive() {
      const { data, error } = await table().select('*').eq('enabled', true).eq('archived', false);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []).map((row: SourceRow) => mapSourceRowToRecord(row));
    },
    async getById(id) {
      const { data, error } = await table().select('*').eq('id', id).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapSourceRowToRecord(data as SourceRow) : null;
    },
    async getBySlug(slug) {
      const { data, error } = await table().select('*').eq('slug', slug).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapSourceRowToRecord(data as SourceRow) : null;
    },
    async list(params: SourceListParams): Promise<PaginatedResult<SourceRecord>> {
      const items = await fetchAllRows();
      return applySourceListParams(items, params);
    },
    async save(item) {
      const payload = mapSourceRecordToRow({
        ...item,
        updatedAt: new Date().toISOString(),
      });
      const { data, error } = await table()
        .upsert(payload as unknown as Record<string, unknown>)
        .select('*')
        .single();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return mapSourceRowToRecord(data as SourceRow);
    },
    async archive(id) {
      const existing = await this.getById(id);
      if (!existing) {
        return null;
      }
      return this.save({
        ...existing,
        archived: true,
        enabled: false,
      });
    },
    async restore(id) {
      const existing = await this.getById(id);
      if (!existing) {
        return null;
      }
      return this.save({
        ...existing,
        archived: false,
      });
    },
    async countImportJobsForSource(sourceId) {
      const { count, error } = await importJobsTable()
        .select('id', { count: 'exact', head: true })
        .eq('source_id', sourceId);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return count ?? 0;
    },
  };
}
