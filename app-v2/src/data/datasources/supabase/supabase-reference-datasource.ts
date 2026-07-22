import { AppError } from '@/core/errors/app-error';
import type {
  CityRecord,
  CollectionRecord,
  GenreRecord,
  SourceRecord,
} from '@/data/types/records';
import type {
  CityDatasource,
  CollectionDatasource,
  GenreDatasource,
  SourceDatasource,
} from '@/data/datasources/types';
import {
  mapCityRecordToRow,
  mapCityRowToRecord,
  mapCollectionRecordToRow,
  mapCollectionRowToRecord,
  mapGenreRecordToRow,
  mapGenreRowToRecord,
  mapSourceRecordToRow,
  mapSourceRowToRecord,
  type CityRow,
  type CollectionRow,
  type GenreRow,
  type SourceRow,
} from '@/data/mappers/reference-mapper';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

function createMappedSupabaseDatasource<TRow, TRecord extends { id: string; active?: boolean }>({
  table,
  mapRowToRecord,
  mapRecordToRow,
}: {
  table: string;
  mapRowToRecord: (row: TRow) => TRecord;
  mapRecordToRow: (record: TRecord) => TRow;
}) {
  const supabase = getSupabaseClient();
  const fromTable = () => supabase.from(table) as SupabaseTable;

  return {
    async getAll() {
      const { data, error } = await fromTable().select('*');
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []).map((row: TRow) => mapRowToRecord(row));
    },
    async getActive() {
      const { data, error } = await fromTable().select('*').eq('active', true);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []).map((row: TRow) => mapRowToRecord(row));
    },
    async getById(id: string) {
      const { data, error } = await fromTable().select('*').eq('id', id).maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data ? mapRowToRecord(data as TRow) : null;
    },
    async save(item: TRecord) {
      const payload = mapRecordToRow(item);
      const { data, error } = await fromTable()
        .upsert(payload as unknown as Record<string, unknown>)
        .select('*')
        .single();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return mapRowToRecord(data as TRow);
    },
  };
}

export function createSupabaseGenreDatasource(): GenreDatasource {
  return createMappedSupabaseDatasource<GenreRow, GenreRecord>({
    table: 'genres',
    mapRowToRecord: mapGenreRowToRecord,
    mapRecordToRow: mapGenreRecordToRow,
  });
}

export function createSupabaseCityDatasource(): CityDatasource {
  return createMappedSupabaseDatasource<CityRow, CityRecord>({
    table: 'cities',
    mapRowToRecord: mapCityRowToRecord,
    mapRecordToRow: mapCityRecordToRow,
  });
}

export function createSupabaseCollectionDatasource(): CollectionDatasource {
  return createMappedSupabaseDatasource<CollectionRow, CollectionRecord>({
    table: 'collections',
    mapRowToRecord: mapCollectionRowToRecord,
    mapRecordToRow: mapCollectionRecordToRow,
  });
}

export function createSupabaseSourceDatasource(): SourceDatasource {
  return createMappedSupabaseDatasource<SourceRow, SourceRecord>({
    table: 'sources',
    mapRowToRecord: mapSourceRowToRecord,
    mapRecordToRow: mapSourceRecordToRow,
  });
}
