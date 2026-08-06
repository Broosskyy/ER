import type { ArtistRecord } from '@/data/types/records';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import type { ImportRecord } from '@/features/import/models/types';
import {
  assessLineupRepairNeed,
  filterValidLineupArtistIds,
} from '@/features/import/services/lineup-projection-integrity';

/** Import payload has structured lineup evidence but canonical event_artists need repair. */
export function needsLineupProjectionRepair(
  record: ImportRecord,
  existingArtistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): boolean {
  return assessLineupRepairNeed(record, existingArtistIds, artistsById).shouldRepair;
}

/** True when every linked lineup artist is a placeholder label (e.g. Organization). */
export function isPlaceholderOnlyLineup(
  artistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): boolean {
  if (artistIds.length === 0) {
    return false;
  }
  return artistIds.every((id) => {
    const name = artistsById.get(id)?.name;
    return isLineupPlaceholderArtist(name);
  });
}

export function baselineExistingArtistIdsForRepair(
  existingArtistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
  incomingNameCount: number,
): string[] {
  const valid = filterValidLineupArtistIds(existingArtistIds, artistsById);
  const invalidCount = existingArtistIds.length - valid.length;
  if (invalidCount > 0) {
    return [];
  }
  if (isPlaceholderOnlyLineup(existingArtistIds, artistsById)) {
    return [];
  }
  if (incomingNameCount > valid.length) {
    return valid;
  }
  return existingArtistIds;
}
