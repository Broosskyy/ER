import { AppError } from '@/core/errors/app-error';
import {
  mapEventLineupEntryRowToResolved,
  mapResolvedLineupEntryToRows,
  type EventLineupEntryRow,
} from '@/data/mappers/event-lineup-entry-mapper';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { isMissingStructuredLineupTableError } from '@/data/datasources/supabase/structured-lineup-table-guard';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

const ENTRY_SELECT =
  'id, event_id, sort_order, billing_relation, stage, start_time, end_time, running_order, confidence, provenance, created_at, updated_at, event_lineup_entry_artists(id, entry_id, artist_id, sort_order, artists(*))';

export function createSupabaseEventLineupEntryDatasource() {
  const supabase = getSupabaseClient();
  const entriesTable = () => supabase.from('event_lineup_entries') as SupabaseTable;
  const entryArtistsTable = () => supabase.from('event_lineup_entry_artists') as SupabaseTable;

  const datasource = {
    async getEntriesForEvent(eventId: string): Promise<ResolvedCanonicalLineupEntry[]> {
      const { data, error } = await entriesTable()
        .select(ENTRY_SELECT)
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });

      if (error) {
        if (isMissingStructuredLineupTableError(error)) {
          return [];
        }
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }

      return ((data ?? []) as EventLineupEntryRow[]).map((row) => mapEventLineupEntryRowToResolved(row));
    },

    async getEntriesForEvents(eventIds: string[]): Promise<Map<string, ResolvedCanonicalLineupEntry[]>> {
      const result = new Map<string, ResolvedCanonicalLineupEntry[]>();
      if (eventIds.length === 0) {
        return result;
      }

      const { data, error } = await entriesTable()
        .select(ENTRY_SELECT)
        .in('event_id', eventIds)
        .order('sort_order', { ascending: true });

      if (error) {
        if (isMissingStructuredLineupTableError(error)) {
          for (const eventId of eventIds) {
            result.set(eventId, []);
          }
          return result;
        }
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }

      for (const row of (data ?? []) as EventLineupEntryRow[]) {
        const bucket = result.get(row.event_id) ?? [];
        bucket.push(mapEventLineupEntryRowToResolved(row));
        result.set(row.event_id, bucket);
      }

      for (const eventId of eventIds) {
        if (!result.has(eventId)) {
          result.set(eventId, []);
        }
      }

      return result;
    },

    async replaceEventLineupEntries(
      eventId: string,
      entries: ResolvedCanonicalLineupEntry[],
    ): Promise<ResolvedCanonicalLineupEntry[]> {
      const { data: existingEntries, error: existingError } = await entriesTable()
        .select('id')
        .eq('event_id', eventId);
      if (existingError) {
        if (isMissingStructuredLineupTableError(existingError)) {
          return entries;
        }
        throw new AppError(existingError.message, {
          code: 'NETWORK',
          retryable: true,
          cause: existingError,
        });
      }

      const existingIds = (existingEntries ?? []).map((row: { id: string }) => row.id);
      if (existingIds.length > 0) {
        const { error: deleteArtistsError } = await entryArtistsTable()
          .delete()
          .in('entry_id', existingIds);
        if (deleteArtistsError) {
          if (isMissingStructuredLineupTableError(deleteArtistsError)) {
            return entries;
          }
          throw new AppError(deleteArtistsError.message, {
            code: 'NETWORK',
            retryable: true,
            cause: deleteArtistsError,
          });
        }
      }

      const { error: deleteEntriesError } = await entriesTable().delete().eq('event_id', eventId);
      if (deleteEntriesError) {
        if (isMissingStructuredLineupTableError(deleteEntriesError)) {
          return entries;
        }
        throw new AppError(deleteEntriesError.message, {
          code: 'NETWORK',
          retryable: true,
          cause: deleteEntriesError,
        });
      }

      if (entries.length === 0) {
        return [];
      }

      const entryRows = entries.map((entry, index) =>
        mapResolvedLineupEntryToRows(eventId, { ...entry, order: index }).entryRow,
      );
      const artistRows = entries.flatMap((entry, index) =>
        mapResolvedLineupEntryToRows(eventId, { ...entry, order: index }).artistRows,
      );

      const { error: insertEntriesError } = await entriesTable().insert(entryRows);
      if (insertEntriesError) {
        if (isMissingStructuredLineupTableError(insertEntriesError)) {
          return entries;
        }
        throw new AppError(insertEntriesError.message, {
          code: 'NETWORK',
          retryable: true,
          cause: insertEntriesError,
        });
      }

      if (artistRows.length > 0) {
        const { error: insertArtistsError } = await entryArtistsTable().insert(artistRows);
        if (insertArtistsError) {
          if (isMissingStructuredLineupTableError(insertArtistsError)) {
            return entries;
          }
          throw new AppError(insertArtistsError.message, {
            code: 'NETWORK',
            retryable: true,
            cause: insertArtistsError,
          });
        }
      }

      return datasource.getEntriesForEvent(eventId);
    },
  };

  return datasource;
}
