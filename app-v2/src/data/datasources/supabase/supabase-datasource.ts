import { featureFlags } from '@/core/config/feature-flags';
import { AppError } from '@/core/errors/app-error';
import { withRetry } from '@/core/errors/with-retry';
import {
  applyEventListParams,
  mapAdminRecordToEventRow,
  mapEventRowToAdminRecord,
  mapEventRowToDomain,
} from '@/data/mappers/event-mapper';
import type {
  AdminEventListParams,
  AdminEventRecord,
  ArtistRecord,
  CityRecord,
  CollectionRecord,
  DashboardStats,
  GenreRecord,
  PaginatedResult,
  SourceRecord,
  VenueRecord,
} from '@/data/types/records';
import type { DatasourceBundle } from '@/data/datasources/types';
import { createLocalDatasourceBundle } from '@/data/datasources/local/local-datasource';
import { createSupabaseImportDatasourceBundle } from '@/data/datasources/supabase/supabase-import-datasource';
import { getSupabaseClient } from '@/services/supabase/client';

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

function createSupabaseTableDatasource<T extends { id: string; active?: boolean }>(
  table: string,
) {
  const supabase = getSupabaseClient();
  return {
    async getAll() {
      const { data, error } = await (supabase.from(table) as SupabaseTable).select('*');
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []) as T[];
    },
    async getActive() {
      const { data, error } = await (supabase.from(table) as SupabaseTable)
        .select('*')
        .eq('active', true);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data ?? []) as T[];
    },
    async getById(id: string) {
      const { data, error } = await (supabase.from(table) as SupabaseTable)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return (data as T | null) ?? null;
    },
    async save(item: T) {
      const { data, error } = await (supabase.from(table) as SupabaseTable)
        .upsert(item as Record<string, unknown>)
        .select('*')
        .single();
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      return data as T;
    },
  };
}

export function createSupabaseDatasourceBundle(): DatasourceBundle {
  const supabase = getSupabaseClient();
  const eventsTable = () => supabase.from('events') as SupabaseTable;

  return {
    events: {
      async getPublishedEvents() {
        const { data, error } = await withRetry(async () =>
          eventsTable().select('*').eq('status', 'published'),
        );
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return (data ?? []).map((row: unknown) => mapEventRowToDomain(row as never));
      },
      async getEventById(id) {
        const { data, error } = await eventsTable().select('*').eq('id', id).maybeSingle();
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return data ? mapEventRowToDomain(data as never) : null;
      },
      async getAllEvents() {
        const { data, error } = await eventsTable().select('*').neq('status', 'deleted');
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return (data ?? []).map((row: unknown) => mapEventRowToAdminRecord(row as never));
      },
      async listEvents(params) {
        const { data, error } = await eventsTable().select('*');
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        const filtered = applyEventListParams(
          (data ?? []).map((row: unknown) => mapEventRowToAdminRecord(row as never)),
          params,
        );
        return paginate(filtered, params.page ?? 1, params.pageSize ?? 20);
      },
      async saveEvent(record) {
        const payload = mapAdminRecordToEventRow({
          ...record,
          updatedAt: new Date().toISOString(),
        });
        const { data, error } = await eventsTable()
          .upsert(payload as unknown as Record<string, unknown>)
          .select('*')
          .single();
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return mapEventRowToAdminRecord(data as never);
      },
      async deleteEvent(id) {
        const { error } = await eventsTable()
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
      },
    },
    genres: createSupabaseTableDatasource<GenreRecord>('genres'),
    cities: createSupabaseTableDatasource<CityRecord>('cities'),
    venues: createSupabaseTableDatasource<VenueRecord>('venues'),
    artists: createSupabaseTableDatasource<ArtistRecord>('artists'),
    collections: createSupabaseTableDatasource<CollectionRecord>('collections'),
    sources: createSupabaseTableDatasource<SourceRecord>('sources'),
    stats: {
      async getDashboardStats(): Promise<DashboardStats> {
        const [events, cities, genres, venues, collections] = await Promise.all([
          eventsTable().select('id', { count: 'exact', head: true }).neq('status', 'deleted'),
          (supabase.from('cities') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .eq('active', true),
          (supabase.from('genres') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .eq('active', true),
          (supabase.from('venues') as SupabaseTable).select('id', { count: 'exact', head: true }),
          (supabase.from('collections') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .eq('active', true),
        ]);
        return {
          events: events.count ?? 0,
          cities: cities.count ?? 0,
          genres: genres.count ?? 0,
          venues: venues.count ?? 0,
          collections: collections.count ?? 0,
        };
      },
    },
    ...createSupabaseImportDatasourceBundle(),
  };
}

let bundle: DatasourceBundle | undefined;

export function getDatasourceBundle(): DatasourceBundle {
  bundle ??= featureFlags.useSupabase
    ? createSupabaseDatasourceBundle()
    : createLocalDatasourceBundle();
  return bundle;
}

export function resetDatasourceBundle(): void {
  bundle = undefined;
}
