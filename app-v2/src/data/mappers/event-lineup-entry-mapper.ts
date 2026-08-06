import type { ArtistRecord } from '@/data/types/records';
import type {
  BillingRelation,
  LineupEntryProvenance,
  ResolvedCanonicalLineupEntry,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import { mapArtistRowToRecord, type ArtistRow } from '@/data/mappers/artist-mapper';

export interface EventLineupEntryRow {
  id: string;
  event_id: string;
  sort_order: number;
  billing_relation: BillingRelation;
  stage?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  running_order?: number | null;
  confidence?: number | null;
  provenance?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  event_lineup_entry_artists?: EventLineupEntryArtistRow[] | EventLineupEntryArtistRow | null;
}

export interface EventLineupEntryArtistRow {
  id: string;
  entry_id: string;
  artist_id: string;
  sort_order: number;
  artists?: ArtistRow | ArtistRow[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function normalizeArtistsRelation(
  value: EventLineupEntryArtistRow[] | EventLineupEntryArtistRow | null | undefined,
): EventLineupEntryArtistRow[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function mapEventLineupEntryRowToResolved(
  row: EventLineupEntryRow,
  artistsById?: Map<string, ArtistRecord>,
): ResolvedCanonicalLineupEntry {
  const artistRows = normalizeArtistsRelation(row.event_lineup_entry_artists)
    .sort((left, right) => left.sort_order - right.sort_order);

  const artistIds: string[] = [];
  const artists: string[] = [];
  for (const artistRow of artistRows) {
    artistIds.push(artistRow.artist_id);
    const embedded = firstRelation(artistRow.artists);
    const record = embedded ? mapArtistRowToRecord(embedded) : artistsById?.get(artistRow.artist_id);
    artists.push(record?.name ?? artistRow.artist_id);
  }

  return {
    entryId: row.id,
    order: row.sort_order,
    artists,
    artistIds,
    billingRelation: row.billing_relation,
    stage: row.stage ?? undefined,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    runningOrder: row.running_order ?? undefined,
    confidence: row.confidence ?? undefined,
    provenance: (row.provenance ?? undefined) as LineupEntryProvenance | undefined,
  };
}

export function mapResolvedLineupEntryToRows(
  eventId: string,
  entry: ResolvedCanonicalLineupEntry,
): {
  entryRow: EventLineupEntryRow;
  artistRows: EventLineupEntryArtistRow[];
} {
  const entryId = entry.entryId ?? `ele-${eventId}-${entry.order}`;
  const now = new Date().toISOString();
  const entryRow: EventLineupEntryRow = {
    id: entryId,
    event_id: eventId,
    sort_order: entry.order,
    billing_relation: entry.billingRelation,
    stage: entry.stage ?? null,
    start_time: entry.startTime ?? null,
    end_time: entry.endTime ?? null,
    running_order: entry.runningOrder ?? null,
    confidence: entry.confidence ?? null,
    provenance: (entry.provenance ?? {}) as Record<string, unknown>,
    created_at: now,
    updated_at: now,
  };

  const artistRows = entry.artistIds.map((artistId, index) => ({
    id: `elea-${entryId}-${artistId}`,
    entry_id: entryId,
    artist_id: artistId,
    sort_order: index,
  }));

  return { entryRow, artistRows };
}
