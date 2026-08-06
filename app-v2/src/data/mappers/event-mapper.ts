import { normalizeIanaTimezone } from '@/features/events/formatting/date-time';
import type { Event } from '@/features/events/types/event';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import type { EventStatus } from '@/features/events/types/event-status';
import { resolveDomainVenueLabel } from '@/features/create/utils/event-venue-display';
import {
  parseCanonicalEventAttributes,
  serializeCanonicalEventAttributes,
} from '@/features/events/domain/event-attribute-merge';
import type { VenueEnvironmentValue } from '@/features/events/domain/canonical-event-attribute-types';

import type {
  AdminEventListParams,
  AdminEventRecord,
  AdminEventStatus,
} from '@/data/types/records';

export interface EventRow {
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
  price_text: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  image_url: string | null;
  flyer_url: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_address?: string | null;
  venue_postal_code?: string | null;
  venue_country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  age_restriction?: string | null;
  ticket_status?: string | null;
  ticket_phases?: unknown;
  genre_labels?: unknown;
  event_attributes?: unknown;
  floor_count?: number | null;
  stage_count?: number | null;
  venue_environment?: string | null;
  last_entry_at?: string | null;
  dress_code?: string | null;
  accessibility_notes?: string | null;
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

function parseVenueEnvironment(value: string | null | undefined): VenueEnvironmentValue | undefined {
  if (value === 'indoor' || value === 'outdoor' || value === 'hybrid') {
    return value;
  }
  return undefined;
}

function parseTicketPhases(value: unknown): CanonicalTicketPhase[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return value as CanonicalTicketPhase[];
}

function parseGenreLabels(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const labels = value.map((entry) => String(entry).trim()).filter(Boolean);
  return labels.length > 0 ? labels : undefined;
}

function mapTicketStatus(value: string | null | undefined): Event['ticketStatus'] | undefined {
  if (
    value === 'not_configured' ||
    value === 'external_link' ||
    value === 'on_sale' ||
    value === 'sold_out' ||
    value === 'sales_ended'
  ) {
    return value;
  }
  return undefined;
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
  lineupEntries?: import('@/features/events/domain/event-lineup-entry-projection').EventLineupEntryProjection[];
  artistIds?: string[];
  organizerName?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  venueType?: import('@/features/events/domain/festival-foundation').VenueType;
  festivalId?: string;
  denormalizedVenueName?: string;
  denormalizedVenueCity?: string;
}): Event {
  const venueLabel = relations?.denormalizedVenueName
    ? resolveDomainVenueLabel({
        joinedVenueName: undefined,
        venueName: relations.denormalizedVenueName,
        venueCity: relations.denormalizedVenueCity,
      })
    : resolveDomainVenueLabel({
        joinedVenueName: relations?.venueName,
        venueName: row.venue_name,
        venueCity: row.venue_city,
      });

  const cityLabel =
    relations?.denormalizedVenueCity ??
    relations?.cityName ??
    row.venue_city?.trim() ??
    'Köln';

  const genreLabels = parseGenreLabels(row.genre_labels);
  const rowLatitude = typeof row.latitude === 'number' ? row.latitude : undefined;
  const rowLongitude = typeof row.longitude === 'number' ? row.longitude : undefined;

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
    artistIds: relations?.artistIds,
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
    venue: venueLabel,
    address: row.venue_address ?? relations?.address,
    city: cityLabel,
    country: row.venue_country_code ?? relations?.country ?? 'Germany',
    latitude: rowLatitude ?? relations?.latitude,
    longitude: rowLongitude ?? relations?.longitude,
    genres: genreLabels ?? (relations?.genreName ? [relations.genreName] : []),
    artists: relations?.artists ?? [],
    lineup: relations?.lineup ?? relations?.artists,
    lineupEntries: relations?.lineupEntries,
    organizer: relations?.organizerName ?? row.organizer ?? undefined,
    ticketUrl: row.ticket_url ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    flyerUrl: row.flyer_url ?? undefined,
    priceText: row.price_text ?? undefined,
    ticketStatus: mapTicketStatus(row.ticket_status),
    ticketPhases: parseTicketPhases(row.ticket_phases),
    eventAttributes: parseCanonicalEventAttributes(row.event_attributes),
    floorCount: typeof row.floor_count === 'number' ? row.floor_count : undefined,
    stageCount: typeof row.stage_count === 'number' ? row.stage_count : undefined,
    venueEnvironment: parseVenueEnvironment(row.venue_environment),
    lastEntryAt: row.last_entry_at ?? undefined,
    dressCode: row.dress_code ?? undefined,
    accessibilityNotes: row.accessibility_notes ?? undefined,
    ageRestriction: row.age_restriction ?? undefined,
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
    priceText: row.price_text ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    facebookUrl: row.facebook_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    flyerUrl: row.flyer_url ?? undefined,
    venueName: row.venue_name ?? undefined,
    venueCity: row.venue_city ?? undefined,
    venueAddress: row.venue_address ?? undefined,
    venuePostalCode: row.venue_postal_code ?? undefined,
    venueCountryCode: row.venue_country_code ?? undefined,
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    ageRestriction: row.age_restriction ?? undefined,
    ticketStatus: mapTicketStatus(row.ticket_status),
    ticketPhases: parseTicketPhases(row.ticket_phases),
    genreLabels: parseGenreLabels(row.genre_labels),
    eventAttributes: parseCanonicalEventAttributes(row.event_attributes),
    floorCount: typeof row.floor_count === 'number' ? row.floor_count : undefined,
    stageCount: typeof row.stage_count === 'number' ? row.stage_count : undefined,
    venueEnvironment: parseVenueEnvironment(row.venue_environment),
    lastEntryAt: row.last_entry_at ?? undefined,
    dressCode: row.dress_code ?? undefined,
    accessibilityNotes: row.accessibility_notes ?? undefined,
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
    price_text: record.priceText ?? null,
    website_url: record.websiteUrl ?? null,
    instagram_url: record.instagramUrl ?? null,
    facebook_url: record.facebookUrl ?? null,
    image_url: record.imageUrl ?? null,
    flyer_url: record.flyerUrl ?? null,
    venue_name: record.venueName ?? null,
    venue_city: record.venueCity ?? null,
    venue_address: record.venueAddress ?? null,
    venue_postal_code: record.venuePostalCode ?? null,
    venue_country_code: record.venueCountryCode ?? null,
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    age_restriction: record.ageRestriction ?? null,
    ticket_status: record.ticketStatus ?? null,
    ticket_phases: record.ticketPhases ?? null,
    genre_labels: record.genreLabels ?? null,
    event_attributes:
      record.eventAttributes && record.eventAttributes.length > 0
        ? serializeCanonicalEventAttributes(record.eventAttributes)
        : null,
    floor_count: record.floorCount ?? null,
    stage_count: record.stageCount ?? null,
    venue_environment: record.venueEnvironment ?? null,
    last_entry_at: record.lastEntryAt ?? null,
    dress_code: record.dressCode ?? null,
    accessibility_notes: record.accessibilityNotes ?? null,
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
  if (params.originEventIds && params.originEventIds.length > 0) {
    const allowed = new Set(params.originEventIds);
    filtered = filtered.filter((event) => allowed.has(event.id));
  }
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
