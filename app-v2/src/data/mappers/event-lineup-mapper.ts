import type { ArtistRecord } from '@/data/types/records';
import type { ArtistBillingRole } from '@/features/events/domain/artist-billing-role';
import type {
  EventArtistRecord,
  EventLineupArtist,
} from '@/features/events/domain/event-lineup';
import { mapArtistRowToRecord, type ArtistRow } from '@/data/mappers/artist-mapper';

export interface EventArtistRow {
  id: string;
  event_id: string;
  artist_id: string;
  billing_role: ArtistBillingRole;
  sort_order: number;
  created_at: string;
  updated_at: string;
  artists?: ArtistRow | ArtistRow[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

export function mapEventArtistRowToRecord(row: EventArtistRow): EventArtistRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    artistId: row.artist_id,
    billingRole: row.billing_role,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEventArtistRecordToRow(
  record: EventArtistRecord,
): EventArtistRow {
  return {
    id: record.id,
    event_id: record.eventId,
    artist_id: record.artistId,
    billing_role: record.billingRole,
    sort_order: record.sortOrder,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapEventArtistRowsToLineup(
  rows: EventArtistRow[],
  artistsById?: Map<string, ArtistRecord>,
): EventLineupArtist[] {
  return [...rows]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((row) => {
      const embedded = firstRelation(row.artists);
      const artist =
        embedded != null
          ? mapArtistRowToRecord(embedded)
          : artistsById?.get(row.artist_id);

      if (!artist) {
        throw new Error(`Missing artist relation for lineup row ${row.id}`);
      }

      return {
        relationshipId: row.id,
        artist,
        billingRole: row.billing_role,
        sortOrder: row.sort_order,
      };
    });
}

export function lineupToArtistNames(lineup: EventLineupArtist[]): string[] {
  return lineup.map((entry) => entry.artist.name);
}
