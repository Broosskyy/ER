import { AppError } from '@/core/errors/app-error';
import type { SourceRecord, SourceListParams, PaginatedResult } from '@/data/types/records';
import type { SourceDatasource } from '@/data/datasources/types';
import {
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

  const SOURCE_SORT_COLUMNS = {
    priority: 'priority',
    displayName: 'display_name',
    trustScore: 'trust_score',
    sourceType: 'source_type',
    created: 'created_at',
    updated: 'updated_at',
  } as const;

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
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
      const sortColumn = SOURCE_SORT_COLUMNS[params.sortBy ?? 'priority'];
      let query = table().select('*', { count: 'exact' });

      if (params.query?.trim()) {
        const escapedQuery = params.query.trim().replace(/[%_(),]/g, '');
        query = query.or(
          `display_name.ilike.%${escapedQuery}%,slug.ilike.%${escapedQuery}%,base_url.ilike.%${escapedQuery}%`,
        );
      }
      if (params.sourceType) query = query.eq('source_type', params.sourceType);
      if (params.parserType) query = query.eq('parser_type', params.parserType);
      if (params.acquisitionStrategy) query = query.eq('acquisition_strategy', params.acquisitionStrategy);
      if (params.enabled !== undefined) query = query.eq('enabled', params.enabled);
      if (params.archived !== undefined) query = query.eq('archived', params.archived);
      if (params.requiresAuthentication !== undefined) {
        query = query.eq('requires_authentication', params.requiresAuthentication);
      }
      if (params.minTrustScore !== undefined) query = query.gte('trust_score', params.minTrustScore);
      if (params.maxTrustScore !== undefined) query = query.lte('trust_score', params.maxTrustScore);
      if (params.minPriority !== undefined) query = query.gte('priority', params.minPriority);
      if (params.maxPriority !== undefined) query = query.lte('priority', params.maxPriority);

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query
        .order(sortColumn, { ascending: sortColumn === 'display_name' || sortColumn === 'source_type' })
        .range(from, from + pageSize - 1);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return {
        items: (data ?? []).map((row: SourceRow) => mapSourceRowToRecord(row)),
        total: count ?? 0,
        page,
        pageSize,
      };
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
