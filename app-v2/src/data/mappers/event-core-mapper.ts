import type { Database } from '@/services/supabase/database.types';
import type {
  EventDetail,
  EventGenre,
  EventLineupAct,
  EventLineupBillingRole,
  EventSummary,
  EventTicket,
  EventVenue,
} from '@/features/events/types/event-core';

type VenueRow = Database['public']['Tables']['venues']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];
type LineupRow = Database['public']['Tables']['event_lineup']['Row'];
type GenreRow = Database['public']['Tables']['event_genres']['Row'];
type TicketRow = Database['public']['Tables']['event_tickets']['Row'];

function mapVenue(row: VenueRow): EventVenue {
  return {
    id: row.id,
    name: row.name,
    addressLine: row.address_line,
    postalCode: row.postal_code,
    city: row.city,
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
    officialUrl: row.official_url,
  };
}

function mapLineupAct(row: LineupRow): EventLineupAct {
  return {
    id: row.id,
    billingName: row.billing_name,
    billingRole: row.billing_role as EventLineupBillingRole,
    sortOrder: row.sort_order,
  };
}

function mapGenre(row: GenreRow): EventGenre {
  return {
    id: row.id,
    genreKey: row.genre_key,
    displayName: row.display_name,
    sortOrder: row.sort_order,
  };
}

function mapTicket(row: TicketRow): EventTicket {
  return {
    id: row.id,
    provider: row.provider,
    ticketUrl: row.ticket_url,
    priceFromMinor: row.price_from_minor,
    currency: row.currency,
    salesStatus: row.sales_status,
    sortOrder: row.sort_order,
  };
}

function selectPrimaryTicket(tickets: EventTicket[]): EventTicket | null {
  if (tickets.length === 0) {
    return null;
  }
  return [...tickets].sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null;
}

export function mapEventSummary(
  event: EventRow,
  venue: VenueRow | null | undefined,
  genres: GenreRow[],
  tickets: TicketRow[],
): EventSummary {
  const mappedGenres = genres
    .map(mapGenre)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const mappedTickets = tickets
    .map(mapTicket)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    id: event.id,
    title: event.title,
    startsAt: event.starts_at ?? '',
    endsAt: event.ends_at,
    timezone: event.timezone,
    imageUrl: event.image_url,
    officialUrl: event.official_url,
    organizerName: event.organizer_name,
    venue: venue ? mapVenue(venue) : null,
    genres: mappedGenres,
    primaryTicket: selectPrimaryTicket(mappedTickets),
  };
}

export function mapEventDetail(
  event: EventRow,
  venue: VenueRow | null | undefined,
  lineup: LineupRow[],
  genres: GenreRow[],
  tickets: TicketRow[],
): EventDetail {
  const summary = mapEventSummary(event, venue, genres, tickets);
  const mappedLineup = lineup
    .map(mapLineupAct)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const mappedTickets = tickets
    .map(mapTicket)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    ...summary,
    description: event.description,
    officialUrl: event.official_url,
    publishedAt: event.published_at,
    lineup: mappedLineup,
    tickets: mappedTickets,
  };
}

export function sortEventSummariesChronologically(summaries: EventSummary[]): EventSummary[] {
  return [...summaries].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}
