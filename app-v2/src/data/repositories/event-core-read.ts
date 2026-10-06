import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mapEventDetail,
  sortEventSummariesChronologically,
} from '@/data/mappers/event-core-mapper';
import type { EventDetail, EventSummary } from '@/features/events/types/event-core';
import { AppError } from '@/core/errors/app-error';
import type { Database } from '@/services/supabase/database.types';

export type EventCoreReadClient = Pick<SupabaseClient<Database>, 'from'>;

type EventRow = Database['public']['Tables']['events']['Row'];
type VenueRow = Database['public']['Tables']['venues']['Row'];
type LineupRow = Database['public']['Tables']['event_lineup']['Row'];
type GenreRow = Database['public']['Tables']['event_genres']['Row'];
type TicketRow = Database['public']['Tables']['event_tickets']['Row'];

export async function fetchPublishedEventDetails(
  client: EventCoreReadClient,
): Promise<EventDetail[]> {
  const { data: events, error: eventsError } = await client
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('starts_at', { ascending: true });

  if (eventsError) {
    throw new AppError(eventsError.message, { code: 'NETWORK', retryable: true });
  }

  if (!events?.length) {
    return [];
  }

  const eventIds = events.map((event) => event.id);
  const venueIds = [...new Set(events.map((event) => event.venue_id).filter(Boolean))] as string[];

  const [venuesResult, lineupResult, genresResult, ticketsResult] = await Promise.all([
    venueIds.length
      ? client.from('venues').select('*').in('id', venueIds)
      : Promise.resolve({ data: [] as VenueRow[], error: null }),
    client
      .from('event_lineup')
      .select('*')
      .in('event_id', eventIds)
      .order('sort_order', { ascending: true }),
    client
      .from('event_genres')
      .select('*')
      .in('event_id', eventIds)
      .order('sort_order', { ascending: true }),
    client
      .from('event_tickets')
      .select('*')
      .in('event_id', eventIds)
      .order('sort_order', { ascending: true }),
  ]);

  for (const result of [venuesResult, lineupResult, genresResult, ticketsResult]) {
    if (result.error) {
      throw new AppError(result.error.message, { code: 'NETWORK', retryable: true });
    }
  }

  const venuesById = new Map((venuesResult.data ?? []).map((venue) => [venue.id, venue]));
  const lineupByEventId = groupRowsByEventId(lineupResult.data ?? []);
  const genresByEventId = groupRowsByEventId(genresResult.data ?? []);
  const ticketsByEventId = groupRowsByEventId(ticketsResult.data ?? []);

  return events.map((event) =>
    mapEventDetail(
      event,
      event.venue_id ? venuesById.get(event.venue_id) : null,
      lineupByEventId.get(event.id) ?? [],
      genresByEventId.get(event.id) ?? [],
      ticketsByEventId.get(event.id) ?? [],
    ),
  );
}

export async function fetchPublishedEventDetailById(
  client: EventCoreReadClient,
  eventId: string,
): Promise<EventDetail | null> {
  const { data: event, error: eventError } = await client
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('status', 'published')
    .maybeSingle();

  if (eventError) {
    throw new AppError(eventError.message, { code: 'NETWORK', retryable: true });
  }

  if (!event) {
    return null;
  }

  const [venueResult, lineupResult, genresResult, ticketsResult] = await Promise.all([
    event.venue_id
      ? client.from('venues').select('*').eq('id', event.venue_id).maybeSingle()
      : Promise.resolve({ data: null as VenueRow | null, error: null }),
    client
      .from('event_lineup')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true }),
    client
      .from('event_genres')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true }),
    client
      .from('event_tickets')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true }),
  ]);

  for (const result of [venueResult, lineupResult, genresResult, ticketsResult]) {
    if (result.error) {
      throw new AppError(result.error.message, { code: 'NETWORK', retryable: true });
    }
  }

  return mapEventDetail(
    event,
    venueResult.data,
    lineupResult.data ?? [],
    genresResult.data ?? [],
    ticketsResult.data ?? [],
  );
}

export function toPublishedSummaries(details: EventDetail[]): EventSummary[] {
  return sortEventSummariesChronologically(
    details.map((detail) => ({
      id: detail.id,
      title: detail.title,
      startsAt: detail.startsAt,
      endsAt: detail.endsAt,
      timezone: detail.timezone,
      imageUrl: detail.imageUrl,
      officialUrl: detail.officialUrl,
      organizerName: detail.organizerName,
      venue: detail.venue,
      genres: detail.genres,
      primaryTicket: detail.primaryTicket,
    })),
  );
}

function groupRowsByEventId<Row extends { event_id: string }>(rows: Row[]): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.event_id) ?? [];
    bucket.push(row);
    grouped.set(row.event_id, bucket);
  }
  return grouped;
}

export type { EventRow, VenueRow, LineupRow, GenreRow, TicketRow };
