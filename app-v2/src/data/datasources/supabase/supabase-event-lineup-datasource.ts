import { AppError } from '@/core/errors/app-error';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { EventLineupArtist } from '@/features/events/domain/event-lineup';
import {
  mapEventArtistRecordToRow,
  mapEventArtistRowToRecord,
  mapEventArtistRowsToLineup,
  type EventArtistRow,
} from '@/data/mappers/event-lineup-mapper';
import { derivePrimaryArtistId } from '@/features/events/domain/event-lineup-primary';
import { getSupabaseClient } from '@/services/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseTable = ReturnType<ReturnType<typeof getSupabaseClient>['from']>;

const LINEUP_SELECT =
  'id, event_id, artist_id, billing_role, sort_order, created_at, updated_at, artists(*)';

export function createSupabaseEventLineupDatasource() {
  const supabase = getSupabaseClient();
  const table = () => supabase.from('event_artists') as SupabaseTable;
  const eventsTable = () => supabase.from('events') as SupabaseTable;

  async function syncPrimaryArtist(eventId: string, lineup: EventLineupInput[]): Promise<void> {
    const primaryArtistId = derivePrimaryArtistId(lineup);
    const { error } = await eventsTable()
      .update({
        artist_id: primaryArtistId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) {
      throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
    }
  }

  return {
    async getLineupForEvent(eventId: string): Promise<EventLineupArtist[]> {
      const { data, error } = await table()
        .select(LINEUP_SELECT)
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }

      return mapEventArtistRowsToLineup((data ?? []) as EventArtistRow[]);
    },

    async getLineupsForEvents(eventIds: string[]): Promise<Map<string, EventLineupArtist[]>> {
      const result = new Map<string, EventLineupArtist[]>();
      if (eventIds.length === 0) {
        return result;
      }

      const { data, error } = await table()
        .select(LINEUP_SELECT)
        .in('event_id', eventIds)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }

      const grouped = new Map<string, EventArtistRow[]>();
      for (const row of (data ?? []) as EventArtistRow[]) {
        const bucket = grouped.get(row.event_id) ?? [];
        bucket.push(row);
        grouped.set(row.event_id, bucket);
      }

      for (const eventId of eventIds) {
        result.set(eventId, mapEventArtistRowsToLineup(grouped.get(eventId) ?? []));
      }

      return result;
    },

    async replaceEventLineup(
      eventId: string,
      lineup: EventLineupInput[],
    ): Promise<EventLineupArtist[]> {
      const { error: deleteError } = await table().delete().eq('event_id', eventId);
      if (deleteError) {
        throw new AppError(deleteError.message, {
          code: 'NETWORK',
          retryable: true,
          cause: deleteError,
        });
      }

      if (lineup.length === 0) {
        await syncPrimaryArtist(eventId, lineup);
        return [];
      }

      const now = new Date().toISOString();
      const payload = lineup.map((entry, index) =>
        mapEventArtistRecordToRow({
          id: `ea-${eventId}-${entry.artistId}-${index}`,
          eventId,
          artistId: entry.artistId,
          billingRole: entry.billingRole,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        }),
      );

      const { data, error } = await table().insert(payload).select(LINEUP_SELECT);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }

      await syncPrimaryArtist(eventId, lineup);
      return mapEventArtistRowsToLineup((data ?? []) as EventArtistRow[]);
    },

    async deleteLineupForEvent(eventId: string): Promise<void> {
      const { error } = await table().delete().eq('event_id', eventId);
      if (error) {
        throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
      }
      await syncPrimaryArtist(eventId, []);
    },
  };
}
