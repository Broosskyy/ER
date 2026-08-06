import type { ArtistRecord } from '@/data/types/records';
import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';

export interface LegacyLineupArtifactCleanupResult {
  markedLegacy: string[];
  skipped: string[];
}

/** Mark invalid collapsed lineup artists as legacy artifacts when safe. */
export async function markCollapsedLineupArtifacts(input: {
  artistIds: string[];
  artistsById: Map<string, ArtistRecord>;
  saveArtist: (artist: ArtistRecord) => Promise<ArtistRecord>;
  eventArtistCounts?: Map<string, number>;
}): Promise<LegacyLineupArtifactCleanupResult> {
  const markedLegacy: string[] = [];
  const skipped: string[] = [];

  for (const artistId of input.artistIds) {
    const artist = input.artistsById.get(artistId);
    if (!artist) {
      skipped.push(artistId);
      continue;
    }
    if (artist.lineupLegacyArtifact) {
      continue;
    }
    if (!isCollapsedLineupArtistName(artist.name)) {
      skipped.push(artistId);
      continue;
    }
    const usageCount = input.eventArtistCounts?.get(artistId) ?? 1;
    if (usageCount > 1) {
      skipped.push(artistId);
      continue;
    }

    await input.saveArtist({ ...artist, lineupLegacyArtifact: true });
    markedLegacy.push(artistId);
  }

  return { markedLegacy, skipped };
}
