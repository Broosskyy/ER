import type { Event } from '@/features/events/types/event';
import type { EventStatus } from '@/features/events/types/event-status';

import type {
  AdminEventListParams,
  AdminEventRecord,
  AdminEventStatus,
} from '@/data/types/records';

interface EventRow {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  genre_id: string | null;
  venue_id: string | null;
  city_id: string | null;
  artist_id: string | null;
  source_id: string | null;
  collection_id: string | null;
  start_date: string;
  end_date: string | null;
  ticket_url: string | null;
  image_url: string | null;
  status: AdminEventStatus;
  created_at: string;
  updated_at: string;
}

function mapAdminStatusToEventStatus(status: AdminEventStatus): EventStatus {
  switch (status) {
    case 'published':
      return 'published';
    case 'review':
      return 'needs_review';
    case 'archived':
      return 'cancelled';
    case 'deleted':
      return 'rejected';
    default:
      return 'imported';
  }
}

export function mapEventRowToDomain(row: EventRow, relations?: {
  venueName?: string;
  cityName?: string;
  genreName?: string;
  artists?: string[];
}): Event {
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url ?? undefined,
    startDateTime: row.start_date,
    endDateTime: row.end_date ?? undefined,
    timezone: 'Europe/Berlin',
    venue: relations?.venueName ?? 'TBA',
    city: relations?.cityName ?? 'Köln',
    country: 'Germany',
    genres: relations?.genreName ? [relations.genreName] : [],
    artists: relations?.artists ?? [],
    ticketUrl: row.ticket_url ?? undefined,
    source: row.source_id ?? 'supabase',
    sourceEventId: row.id,
    status: mapAdminStatusToEventStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEventRowToAdminRecord(row: EventRow): AdminEventRecord {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description,
    genreId: row.genre_id ?? undefined,
    venueId: row.venue_id ?? undefined,
    cityId: row.city_id ?? undefined,
    artistId: row.artist_id ?? undefined,
    sourceId: row.source_id ?? undefined,
    collectionId: row.collection_id ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    ticketUrl: row.ticket_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAdminRecordToEventRow(record: AdminEventRecord): EventRow {
  return {
    id: record.id,
    title: record.title,
    subtitle: record.subtitle ?? null,
    description: record.description,
    genre_id: record.genreId ?? null,
    venue_id: record.venueId ?? null,
    city_id: record.cityId ?? null,
    artist_id: record.artistId ?? null,
    source_id: record.sourceId ?? null,
    collection_id: record.collectionId ?? null,
    start_date: record.startDate,
    end_date: record.endDate ?? null,
    ticket_url: record.ticketUrl ?? null,
    image_url: record.imageUrl ?? null,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function applyEventListParams<T extends AdminEventRecord>(
  items: T[],
  params: AdminEventListParams,
): T[] {
  let filtered = [...items];
  const query = params.query?.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query),
    );
  }
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((event) => event.status === params.status);
  }
  if (params.sortBy === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (params.sortBy === 'updated') {
    filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } else {
    filtered.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  return filtered;
}
