import { getSupabase } from '@/lib/supabase/client';
import { EventRow, EventArtistRow } from '@/types/database';
import { EventEntity, EventFilterParams, PaginationParams } from '@/domain/event/types';
import { eventRowToEntity } from '@/utils/eventEntityMapper';
import { ServiceResult } from '@/services/types';

async function fetchLineupMap(eventIds: string[]): Promise<Map<string, string[]>> {
  const supabase = getSupabase();
  const map = new Map<string, string[]>();
  if (!supabase || eventIds.length === 0) return map;

  const { data } = await supabase.from('event_artists').select('*').in('event_id', eventIds);
  (data ?? []).forEach((artist: EventArtistRow) => {
    const list = map.get(artist.event_id) ?? [];
    list.push(artist.artist_name);
    map.set(artist.event_id, list);
  });
  return map;
}

function rowsToEntities(rows: EventRow[], lineupMap: Map<string, string[]>): EventEntity[] {
  return rows.map((row) => eventRowToEntity(row, lineupMap.get(row.id) ?? []));
}

export class EventRepository {
  async findById(id: string): Promise<ServiceResult<EventEntity | null>> {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: null, offline: true };

    const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (error) return { data: null, error: error.message, offline: false };
    if (!data) return { data: null, error: null, offline: false };

    const row = data as EventRow;
    const lineup = await fetchLineupMap([row.id]);
    return { data: eventRowToEntity(row, lineup.get(row.id) ?? []), error: null, offline: false };
  }

  async findMany(
    filter: EventFilterParams = {},
    pagination: PaginationParams = {}
  ): Promise<ServiceResult<EventEntity[]>> {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: null, offline: true };

    const orderBy = pagination.orderBy ?? 'updated_at';
    const ascending = pagination.ascending ?? false;
    let query = supabase.from('events').select('*').order(orderBy, { ascending });

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query = query.in('lifecycle_status', statuses);
    }
    if (filter.createdBy) query = query.eq('created_by', filter.createdBy);
    if (filter.organizerId) query = query.eq('organizer_id', filter.organizerId);
    if (filter.sourceType) query = query.eq('source_type', filter.sourceType);

    const limit = pagination.limit ?? 50;
    if (pagination.offset != null) {
      query = query.range(pagination.offset, pagination.offset + limit - 1);
    } else if (pagination.limit) {
      query = query.limit(pagination.limit);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message, offline: false };

    const rows = (data ?? []) as EventRow[];
    const lineup = await fetchLineupMap(rows.map((r) => r.id));
    return { data: rowsToEntities(rows, lineup), error: null, offline: false };
  }

  async insert(row: Partial<EventRow> & Pick<EventRow, 'title' | 'start_datetime' | 'city' | 'country' | 'venue_name' | 'lifecycle_status'>): Promise<ServiceResult<EventRow>> {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

    const { data, error } = await supabase.from('events').insert(row).select('*').single();
    if (error) return { data: null, error: error.message, offline: false };
    return { data: data as EventRow, error: null, offline: false };
  }

  async update(id: string, patch: Partial<EventRow>): Promise<ServiceResult<EventRow>> {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

    const { data, error } = await supabase.from('events').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) return { data: null, error: error.message, offline: false };
    return { data: data as EventRow, error: null, offline: false };
  }

  async deleteSoft(id: string): Promise<ServiceResult<EventRow>> {
    return this.update(id, {
      lifecycle_status: 'deleted',
      deleted_at: new Date().toISOString(),
    });
  }

  async replaceLineup(eventId: string, lineup: string[]): Promise<ServiceResult<void>> {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

    await supabase.from('event_artists').delete().eq('event_id', eventId);
    if (lineup.length > 0) {
      const { error } = await supabase.from('event_artists').insert(
        lineup.map((name, i) => ({ event_id: eventId, artist_name: name.trim(), sort_order: i }))
      );
      if (error) return { data: null, error: error.message, offline: false };
    }
    return { data: undefined, error: null, offline: false };
  }
}

export const eventRepository = new EventRepository();
