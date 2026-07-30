import { normalizeIanaTimezone } from '@/features/events/formatting/date-time';
import type { Event } from '@/features/events/types/event';
import type { EventStatus } from '@/features/events/types/event-status';
import { resolveDomainVenueLabel } from '@/features/create/utils/event-venue-display';

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
  organizer_id: string | null;
  organizer: string | null;
  city_id: string | null;
  artist_id: string | null;
  source_id: string | null;
  collection_id: string | null;
  start_date: string;
  end_date: string | null;
  ticket_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  image_url: string | null;
  flyer_url: string | null;
  venue_name: string | null;
  venue_city: string | null;
  timezone?: string | null;
  doors_open_at?: string | null;
  sales_start_at?: string | null;
  sales_end_at?: string | null;
  cancelled_at?: string | null;
  postponed_at?: string | null;
  published_at?: string | null;
  first_published_at?: string | null;
  last_seen_at?: string | null;
  last_imported_at?: string | null;
  canonical_event_id?: string | null;
  duplicate_group_id?: string | null;
  festival_edition_id?: string | null;
  status: AdminEventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapAdminStatusToEventStatus(status: AdminEventStatus): EventStatus {
  return status;
}

export function mapEventRowToDomain(row: EventRow, relations?: {
  venueName?: string;
  cityName?: string;
  genreName?: string;
  artists?: string[];
  lineup?: string[];
  organizerName?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  venueType?: import('@/features/events/domain/festival-foundation').VenueType;
  festivalId?: string;
}): Event {
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url ?? undefined,
    startDateTime: row.start_date,
    endDateTime: row.end_date ?? undefined,
    timezone: normalizeIanaTimezone(row.timezone),
    venueId: row.venue_id ?? undefined,
    organizerId: row.organizer_id ?? undefined,
    artistIds: row.artist_id ? [row.artist_id] : undefined,
    genreIds: row.genre_id ? [row.genre_id] : undefined,
    doorsOpenAt: row.doors_open_at ?? undefined,
    salesStartAt: row.sales_start_at ?? undefined,
    salesEndAt: row.sales_end_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    postponedAt: row.postponed_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    canonicalEventId: row.canonical_event_id ?? undefined,
    festivalEditionId: row.festival_edition_id ?? undefined,
    festivalId: relations?.festivalId,
    venueType: relations?.venueType,
    venue: resolveDomainVenueLabel({
      joinedVenueName: relations?.venueName,
      venueName: row.venue_name,
      venueCity: row.venue_city,
    }),
    address: relations?.address,
    city: relations?.cityName ?? row.venue_city?.trim() ?? 'Köln',
    country: relations?.country ?? 'Germany',
    latitude: relations?.latitude,
    longitude: relations?.longitude,
    genres: relations?.genreName ? [relations.genreName] : [],
    artists: relations?.artists ?? [],
    lineup: relations?.lineup ?? relations?.artists,
    organizer: relations?.organizerName ?? row.organizer ?? undefined,
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
    websiteUrl: row.website_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    facebookUrl: row.facebook_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    flyerUrl: row.flyer_url ?? undefined,
    venueName: row.venue_name ?? undefined,
    venueCity: row.venue_city ?? undefined,
    organizerId: row.organizer_id ?? undefined,
    organizerName: row.organizer ?? undefined,
    festivalEditionId: row.festival_edition_id ?? undefined,
    timezone: row.timezone ?? undefined,
    doorsOpenAt: row.doors_open_at ?? undefined,
    salesStartAt: row.sales_start_at ?? undefined,
    salesEndAt: row.sales_end_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    postponedAt: row.postponed_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    firstPublishedAt: row.first_published_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    lastImportedAt: row.last_imported_at ?? undefined,
    canonicalEventId: row.canonical_event_id ?? undefined,
    duplicateGroupId: row.duplicate_group_id ?? undefined,
    status: row.status,
    createdBy: row.created_by ?? undefined,
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
    website_url: record.websiteUrl ?? null,
    instagram_url: record.instagramUrl ?? null,
    facebook_url: record.facebookUrl ?? null,
    image_url: record.imageUrl ?? null,
    flyer_url: record.flyerUrl ?? null,
    venue_name: record.venueName ?? null,
    venue_city: record.venueCity ?? null,
    organizer_id: record.organizerId ?? null,
    organizer: record.organizerName ?? null,
    timezone: record.timezone ?? null,
    doors_open_at: record.doorsOpenAt ?? null,
    sales_start_at: record.salesStartAt ?? null,
    sales_end_at: record.salesEndAt ?? null,
    cancelled_at: record.cancelledAt ?? null,
    postponed_at: record.postponedAt ?? null,
    published_at: record.publishedAt ?? null,
    first_published_at: record.firstPublishedAt ?? null,
    last_seen_at: record.lastSeenAt ?? null,
    last_imported_at: record.lastImportedAt ?? null,
    canonical_event_id: record.canonicalEventId ?? null,
    duplicate_group_id: record.duplicateGroupId ?? null,
    festival_edition_id: record.festivalEditionId ?? null,
    status: record.status,
    created_by: record.createdBy ?? null,
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
