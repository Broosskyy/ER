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
  DashboardStats,
  PaginatedResult,
  VenueRecord,
} from '@/data/types/records';
import type { DatasourceBundle } from '@/data/datasources/types';
import type { ContributorEventListParams } from '@/data/datasources/types';
import { createLocalDatasourceBundle } from '@/data/datasources/local/local-datasource';
import { createSupabaseImportDatasourceBundle } from '@/data/datasources/supabase/supabase-import-datasource';
import { createSupabaseArtistDatasource } from '@/data/datasources/supabase/supabase-artist-datasource';
import { createSupabaseVenueDatasource } from '@/data/datasources/supabase/supabase-venue-datasource';
import { createSupabaseOrganizerDatasource } from '@/data/datasources/supabase/supabase-organizer-datasource';
import {
  createSupabaseCityDatasource,
  createSupabaseCollectionDatasource,
  createSupabaseGenreDatasource,
} from '@/data/datasources/supabase/supabase-reference-datasource';
import { createSupabaseSourceDatasource } from '@/data/datasources/supabase/supabase-source-datasource';
import { createSupabaseEventLineupDatasource } from '@/data/datasources/supabase/supabase-event-lineup-datasource';
import { createSupabaseEventLineupEntryDatasource } from '@/data/datasources/supabase/supabase-event-lineup-entry-datasource';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { EventLineupArtist } from '@/features/events/domain/event-lineup';
import type { Event } from '@/features/events/types/event';
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

const PUBLISHED_EVENT_SELECT =
  '*, venues(name, city, country, street, house_number, latitude, longitude, address, venue_type), organizers(name), cities(name), genres(name), artists(name), festival_editions(festival_id)';

interface SupabaseVenueRelation {
  name?: string;
  city?: string | null;
  country?: string | null;
  street?: string | null;
  house_number?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  venue_type?: string | null;
}

interface SupabaseFestivalEditionRelation {
  festival_id?: string | null;
}

interface SupabaseEventRowWithRelations {
  venues?: SupabaseVenueRelation | SupabaseVenueRelation[] | null;
  organizers?: { name?: string } | { name?: string }[] | null;
  cities?: { name?: string } | { name?: string }[] | null;
  genres?: { name?: string } | { name?: string }[] | null;
  artists?: { name?: string } | { name?: string }[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function mapSupabaseEventRow(
  row: SupabaseEventRowWithRelations & Record<string, unknown>,
  lineupArtists?: EventLineupArtist[],
  lineupEntries?: ResolvedCanonicalLineupEntry[],
) {
  const venue = firstRelation(row.venues);
  const organizer = firstRelation(row.organizers);
  const city = firstRelation(row.cities);
  const genre = firstRelation(row.genres);
  const festivalEdition = firstRelation(
    row.festival_editions as SupabaseFestivalEditionRelation | SupabaseFestivalEditionRelation[] | null,
  );

  const rowVenueName = typeof row.venue_name === 'string' ? row.venue_name.trim() : '';
  const rowVenueCity = typeof row.venue_city === 'string' ? row.venue_city.trim() : '';
  const joinedVenueCity = venue?.city?.trim() ?? '';
  const preferDenormalizedVenue =
    Boolean(rowVenueName) &&
    Boolean(rowVenueCity) &&
    joinedVenueCity.length > 0 &&
    rowVenueCity.toLowerCase() !== joinedVenueCity.toLowerCase();

  const rowLatitude = typeof row.latitude === 'number' ? row.latitude : undefined;
  const rowLongitude = typeof row.longitude === 'number' ? row.longitude : undefined;

  const canonicalLineup = readCanonicalLineup({
    structuredEntries: lineupEntries ?? [],
    compatibilityLineup: lineupArtists,
    eventTitle: typeof row.title === 'string' ? row.title : undefined,
  });

  return mapEventRowToDomain(row as never, {
    venueName: preferDenormalizedVenue ? rowVenueName : venue?.name,
    cityName: preferDenormalizedVenue ? rowVenueCity : venue?.city ?? city?.name ?? rowVenueCity,
    genreName: genre?.name,
    artists: canonicalLineup.artistNames,
    lineup: canonicalLineup.artistNames,
    lineupEntries: canonicalLineup.lineupEntries,
    artistIds: canonicalLineup.artistIds.length > 0 ? canonicalLineup.artistIds : undefined,
    organizerName: organizer?.name,
    latitude: rowLatitude ?? (preferDenormalizedVenue ? undefined : venue?.latitude ?? undefined),
    longitude: rowLongitude ?? (preferDenormalizedVenue ? undefined : venue?.longitude ?? undefined),
    address: venue?.address ?? venue?.street ?? undefined,
    country: venue?.country ?? undefined,
    venueType: (venue?.venue_type as import('@/features/events/domain/festival-foundation').VenueType | undefined) ?? undefined,
    festivalId: festivalEdition?.festival_id ?? undefined,
    denormalizedVenueName: rowVenueName || undefined,
    denormalizedVenueCity: rowVenueCity || undefined,
  });
}

function sortContributorEvents(items: AdminEventRecord[]): AdminEventRecord[] {
  return [...items].sort((left, right) => {
    const updatedCompare = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedCompare !== 0) {
      return updatedCompare;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function createSupabaseDatasourceBundle(): DatasourceBundle {
  const supabase = getSupabaseClient();
  const eventsTable = () => supabase.from('events') as SupabaseTable;
  const eventLineups = createSupabaseEventLineupDatasource();
  const eventLineupEntries = createSupabaseEventLineupEntryDatasource();

  async function mapPublishedRows(rows: unknown[]): Promise<Event[]> {
    const eventIds = rows.map((row) => (row as { id: string }).id);
    const [lineups, structuredLineups] = await Promise.all([
      eventLineups.getLineupsForEvents(eventIds),
      eventLineupEntries.getEntriesForEvents(eventIds),
    ]);
    return rows.map((row) => {
      const eventId = (row as { id: string }).id;
      const lineup = lineups.get(eventId) ?? [];
      const entries = structuredLineups.get(eventId) ?? [];
      return mapSupabaseEventRow(row as never, lineup, entries);
    });
  }

  return {
    events: {
      async getPublishedEvents() {
        const { data, error } = await withRetry(async () =>
          eventsTable().select(PUBLISHED_EVENT_SELECT).eq('status', 'published'),
        );
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return mapPublishedRows(data ?? []);
      },
      async getEventById(id) {
        const { data, error } = await eventsTable()
          .select(PUBLISHED_EVENT_SELECT)
          .eq('id', id)
          .maybeSingle();
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        if (!data) {
          return null;
        }
        const [lineup, entries] = await Promise.all([
          eventLineups.getLineupForEvent(id),
          eventLineupEntries.getEntriesForEvent(id),
        ]);
        return mapSupabaseEventRow(data as never, lineup, entries);
      },
      async getAllEvents() {
        const { data, error } = await eventsTable().select('*');
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return (data ?? []).map((row: unknown) => mapEventRowToAdminRecord(row as never));
      },
      async listEventsByCreatedBy(userId, params?: ContributorEventListParams) {
        let query = eventsTable().select('*').eq('created_by', userId);
        if (params?.status) {
          query = query.eq('status', params.status);
        }
        const { data, error } = await query.order('updated_at', { ascending: false });
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return sortContributorEvents(
          (data ?? []).map((row: unknown) => mapEventRowToAdminRecord(row as never)),
        );
      },
      async getContributorEventById(eventId, userId) {
        const { data, error } = await eventsTable()
          .select('*')
          .eq('id', eventId)
          .eq('created_by', userId)
          .maybeSingle();
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
        return data ? mapEventRowToAdminRecord(data as never) : null;
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
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
      },
      async deleteContributorDraft(eventId, userId) {
        const { error } = await eventsTable()
          .delete()
          .eq('id', eventId)
          .eq('created_by', userId)
          .eq('status', 'draft');
        if (error) {
          throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
        }
      },
    },
    genres: createSupabaseGenreDatasource(),
    cities: createSupabaseCityDatasource(),
    venues: createSupabaseVenueDatasource(),
    organizers: createSupabaseOrganizerDatasource(),
    artists: createSupabaseArtistDatasource(),
    eventLineups,
    eventLineupEntries,
    collections: createSupabaseCollectionDatasource(),
    sources: createSupabaseSourceDatasource(),
    stats: {
      async getDashboardStats(): Promise<DashboardStats> {
        const [events, cities, genres, venues, artists, organizers, collections] = await Promise.all([
          eventsTable().select('id', { count: 'exact', head: true }).neq('status', 'archived'),
          (supabase.from('cities') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .eq('active', true),
          (supabase.from('genres') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .eq('active', true),
          (supabase.from('venues') as SupabaseTable).select('id', { count: 'exact', head: true }),
          (supabase.from('artists') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .neq('status', 'archived'),
          (supabase.from('organizers') as SupabaseTable).select('id', { count: 'exact', head: true }),
          (supabase.from('collections') as SupabaseTable)
            .select('id', { count: 'exact', head: true })
            .eq('active', true),
        ]);
        return {
          events: events.count ?? 0,
          cities: cities.count ?? 0,
          genres: genres.count ?? 0,
          venues: venues.count ?? 0,
          artists: artists.count ?? 0,
          organizers: organizers.count ?? 0,
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
