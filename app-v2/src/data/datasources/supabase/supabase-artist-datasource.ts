import { AppError } from '@/core/errors/app-error';
import type { ArtistRecord, ArtistListParams, PaginatedResult } from '@/data/types/records';
import type { ArtistDatasource } from '@/data/datasources/types';
import {
  applyArtistListParams,
  mapArtistRecordToRow,
  mapArtistRowToRecord,
  type ArtistRow,
} from '@/data/mappers/artist-mapper';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

export function createSupabaseArtistDatasource(): ArtistDatasource {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('artists') as SupabaseTable;

  async function fetchAllRows(): Promise<ArtistRecord[]> {
    const { data, error } = await table().select('*');
    if (error) {
      throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
    }
    return (data ?? []).map((row: ArtistRow) => mapArtistRowToRecord(row));
  }

  return {
    async getAll() {
      return fetchAllRows();
    },
    async getPublished() {
      const { data, error } = await table().select('*').eq('status', 'published');
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []).map((row: ArtistRow) => mapArtistRowToRecord(row));
    },
    async getById(id) {
      const { data, error } = await table().select('*').eq('id', id).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapArtistRowToRecord(data as ArtistRow) : null;
    },
    async getPublishedById(id) {
      const { data, error } = await table()
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapArtistRowToRecord(data as ArtistRow) : null;
    },
    async getBySlug(slug) {
      const { data, error } = await table().select('*').eq('slug', slug).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapArtistRowToRecord(data as ArtistRow) : null;
    },
    async getPublishedBySlug(slug) {
      const { data, error } = await table()
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapArtistRowToRecord(data as ArtistRow) : null;
    },
    async list(params: ArtistListParams): Promise<PaginatedResult<ArtistRecord>> {
      const items = await fetchAllRows();
      return applyArtistListParams(items, params);
    },
    async save(item) {
      const payload = mapArtistRecordToRow({
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
      return mapArtistRowToRecord(data as ArtistRow);
    },
  };
}
