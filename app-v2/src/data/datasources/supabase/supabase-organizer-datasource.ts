import { AppError } from '@/core/errors/app-error';
import type { OrganizerRecord, OrganizerListParams, PaginatedResult } from '@/data/types/records';
import type { OrganizerDatasource } from '@/data/datasources/types';
import {
  applyOrganizerListParams,
  mapOrganizerRecordToRow,
  mapOrganizerRowToRecord,
  type OrganizerRow,
} from '@/data/mappers/organizer-mapper';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

export function createSupabaseOrganizerDatasource(): OrganizerDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('organizers') as SupabaseTable;
  const eventsTable = () => supabase.from('events') as SupabaseTable;

  async function fetchAllRows(): Promise<OrganizerRecord[]> {
    const { data, error } = await table().select('*');
    if (error) {
      throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
    }
    return (data ?? []).map((row: OrganizerRow) => mapOrganizerRowToRecord(row));
  }

  return {
    async getAll() {
      return fetchAllRows();
    },
    async getById(id) {
      const { data, error } = await table().select('*').eq('id', id).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapOrganizerRowToRecord(data as OrganizerRow) : null;
    },
    async getBySlug(slug) {
      const { data, error } = await table().select('*').eq('slug', slug).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapOrganizerRowToRecord(data as OrganizerRow) : null;
    },
    async list(params: OrganizerListParams): Promise<PaginatedResult<OrganizerRecord>> {
      const items = await fetchAllRows();
      return applyOrganizerListParams(items, params);
    },
    async save(item) {
      const payload = mapOrganizerRecordToRow({
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
      return mapOrganizerRowToRecord(data as OrganizerRow);
    },
    async delete(id) {
      const { error } = await table().delete().eq('id', id);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
    },
    async countEventsForOrganizer(organizerId) {
      const { count, error } = await eventsTable()
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizerId);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return count ?? 0;
    },
    async listEventIdsForOrganizer(organizerId) {
      const { data, error } = await eventsTable().select('id').eq('organizer_id', organizerId);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []).map((row: { id: string }) => row.id);
    },
  };
}
