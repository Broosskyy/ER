import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { EventArtistRecord } from '@/features/events/domain/event-lineup';
import type { EventLineupArtist } from '@/features/events/domain/event-lineup';
import type { ArtistRecord } from '@/data/types/records';
import {
  mapEventArtistRowsToLineup,
  type EventArtistRow,
} from '@/data/mappers/event-lineup-mapper';
import { derivePrimaryArtistId } from '@/features/events/domain/event-lineup-primary';

function createRelationshipId(_eventId: string, _artistId: string, index: number): string {
  return `ea-local-${index}-${Date.now().toString(36)}`;
}

export function createLocalEventLineupDatasource(
  getRows: () => EventArtistRecord[],
  setRows: (rows: EventArtistRecord[]) => void,
  getArtists: () => ArtistRecord[],
  updateEventPrimaryArtist: (eventId: string, artistId: string | null) => Promise<void>,
) {
  return {
    async getLineupForEvent(eventId: string): Promise<EventLineupArtist[]> {
      const artistsById = new Map(getArtists().map((artist) => [artist.id, artist]));
      const rows = getRows()
        .filter((row) => row.eventId === eventId)
        .map((row) => ({
          ...row,
          event_id: row.eventId,
          artist_id: row.artistId,
          billing_role: row.billingRole,
          sort_order: row.sortOrder,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        })) as EventArtistRow[];

      return mapEventArtistRowsToLineup(rows, artistsById);
    },

    async getLineupsForEvents(eventIds: string[]): Promise<Map<string, EventLineupArtist[]>> {
      const result = new Map<string, EventLineupArtist[]>();
      for (const eventId of eventIds) {
        result.set(eventId, await this.getLineupForEvent(eventId));
      }
      return result;
    },

    async replaceEventLineup(
      eventId: string,
      lineup: EventLineupInput[],
    ): Promise<EventLineupArtist[]> {
      const now = new Date().toISOString();
      const artistsById = new Map(getArtists().map((artist) => [artist.id, artist]));
      const remaining = getRows().filter((row) => row.eventId !== eventId);
      const nextRows: EventArtistRecord[] = lineup.map((entry, index) => ({
        id: createRelationshipId(eventId, entry.artistId, index),
        eventId,
        artistId: entry.artistId,
        billingRole: entry.billingRole,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      }));

      setRows([...remaining, ...nextRows]);
      await updateEventPrimaryArtist(eventId, derivePrimaryArtistId(lineup));

      const mappedRows = nextRows.map((row) => ({
        ...row,
        event_id: row.eventId,
        artist_id: row.artistId,
        billing_role: row.billingRole,
        sort_order: row.sortOrder,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      })) as EventArtistRow[];

      return mapEventArtistRowsToLineup(mappedRows, artistsById);
    },

    async deleteLineupForEvent(eventId: string): Promise<void> {
      setRows(getRows().filter((row) => row.eventId !== eventId));
      await updateEventPrimaryArtist(eventId, null);
    },
  };
}

export function buildLocalEventArtistsFromLegacy(
  adminEvents: Array<{ id: string; artistId?: string }>,
): EventArtistRecord[] {
  const now = new Date().toISOString();
  const rows: EventArtistRecord[] = [];

  for (const event of adminEvents) {
    if (!event.artistId) {
      continue;
    }

    rows.push({
      id: createRelationshipId(event.id, event.artistId, 0),
      eventId: event.id,
      artistId: event.artistId,
      billingRole: 'headliner',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  return rows;
}
