import type { ArtistRecord } from '@/data/types/records';
import { evaluateArtistCandidate } from '@/features/events/domain/artist-candidate-quality-gate';

export interface InvalidArtistCleanupRow {
  artistId: string;
  artistName: string;
  signals: string[];
  linkedEventIds: string[];
  safeToDetach: boolean;
  safeToMarkLegacy: boolean;
  requiresManualReview: boolean;
}

export function classifyInvalidLineupArtist(
  artist: Pick<ArtistRecord, 'id' | 'name' | 'verificationStatus' | 'lineupLegacyArtifact'>,
  linkedEventIds: string[],
): InvalidArtistCleanupRow {
  const gate = evaluateArtistCandidate({
    name: artist.name,
    sourceField: 'lineup',
    knownCanonicalNames: artist.lineupLegacyArtifact ? [] : undefined,
  });
  const invalid = gate.decision === 'invalid';
  const unverified = artist.verificationStatus === 'unverified';
  return {
    artistId: artist.id,
    artistName: artist.name,
    signals: gate.signals,
    linkedEventIds,
    safeToDetach: invalid,
    safeToMarkLegacy: invalid && unverified && !artist.lineupLegacyArtifact,
    requiresManualReview: gate.decision === 'review_required',
  };
}

export async function markInvalidLineupArtifacts(input: {
  artistIds: string[];
  artistsById: Map<string, ArtistRecord>;
  saveArtist: (artist: ArtistRecord) => Promise<ArtistRecord>;
}): Promise<{ markedLegacy: string[]; skipped: string[] }> {
  const markedLegacy: string[] = [];
  const skipped: string[] = [];

  for (const artistId of input.artistIds) {
    const artist = input.artistsById.get(artistId);
    if (!artist) {
      skipped.push(artistId);
      continue;
    }
    const classification = classifyInvalidLineupArtist(artist, []);
    if (!classification.safeToMarkLegacy) {
      skipped.push(artistId);
      continue;
    }
    await input.saveArtist({ ...artist, lineupLegacyArtifact: true });
    markedLegacy.push(artistId);
  }

  return { markedLegacy, skipped };
}
