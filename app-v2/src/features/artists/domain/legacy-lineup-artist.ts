import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import type { ArtistRecord } from '@/data/types/records';

export function isLegacyLineupArtifact(artist: Pick<ArtistRecord, 'lineupLegacyArtifact' | 'name'>): boolean {
  if (artist.lineupLegacyArtifact) {
    return true;
  }
  return isCollapsedLineupArtistName(artist.name);
}

export function isPublicArtistRecord(artist: Pick<ArtistRecord, 'status' | 'lineupLegacyArtifact' | 'name'>): boolean {
  return artist.status === 'published' && !isLegacyLineupArtifact(artist);
}
