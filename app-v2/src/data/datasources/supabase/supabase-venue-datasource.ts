import { AppError } from '@/core/errors/app-error';
import type { VenueRecord, VenueListParams, PaginatedResult } from '@/data/types/records';
import type { VenueDatasource } from '@/data/datasources/types';
import {
  applyVenueListParams,
  mapVenueRecordToRow,
  mapVenueRowToRecord,
  type VenueRow,
} from '@/data/mappers/venue-mapper';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

export function createSupabaseVenueDatasource(): VenueDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('venues') as SupabaseTable;
  const eventsTable = () => supabase.from('events') as SupabaseTable;

  async function fetchAllRows(): Promise<VenueRecord[]> {
    const { data, error } = await table().select('*');
    if (error) {
      throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
    }
    return (data ?? []).map((row: VenueRow) => mapVenueRowToRecord(row));
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
      return data ? mapVenueRowToRecord(data as VenueRow) : null;
    },
    async getBySlug(slug) {
      const { data, error } = await table().select('*').eq('slug', slug).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapVenueRowToRecord(data as VenueRow) : null;
    },
    async list(params: VenueListParams): Promise<PaginatedResult<VenueRecord>> {
      const items = await fetchAllRows();
      return applyVenueListParams(items, params);
    },
    async save(item) {
      const payload = mapVenueRecordToRow({
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
      return mapVenueRowToRecord(data as VenueRow);
    },
    async delete(id) {
      const { error } = await table().delete().eq('id', id);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
    },
    async countEventsForVenue(venueId) {
      const { count, error } = await eventsTable()
        .select('id', { count: 'exact', head: true })
        .eq('venue_id', venueId);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return count ?? 0;
    },
    async listEventIdsForVenue(venueId) {
      const { data, error } = await eventsTable().select('id').eq('venue_id', venueId);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []).map((row: { id: string }) => row.id);
    },
  };
}
