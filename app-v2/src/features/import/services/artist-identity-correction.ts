import type { ArtistRecord } from '@/data/types/records';
import type { EntityIdentityAlias } from '@/features/entity-resolution/types';

export interface ArtistDisplayNameCorrectionResult {
  updated: boolean;
  artistId: string;
  previousName: string;
  nextName: string;
  aliasCreated: boolean;
}

/** Rename display name while preserving source spelling as an auditable alias. */
export async function applyArtistDisplayNameCorrection(input: {
  artist: ArtistRecord;
  nextDisplayName: string;
  preserveSourceSpelling?: string;
  sourceId?: string;
  saveArtist: (artist: ArtistRecord) => Promise<ArtistRecord>;
  saveAlias?: (alias: EntityIdentityAlias) => void | Promise<void>;
}): Promise<ArtistDisplayNameCorrectionResult> {
  const trimmed = input.nextDisplayName.trim();
  if (!trimmed || trimmed === input.artist.name) {
    return {
      updated: false,
      artistId: input.artist.id,
      previousName: input.artist.name,
      nextName: input.artist.name,
      aliasCreated: false,
    };
  }

  const previousName = input.artist.name;
  await input.saveArtist({ ...input.artist, name: trimmed });

  let aliasCreated = false;
  const aliasSpelling = input.preserveSourceSpelling?.trim();
  if (
    aliasSpelling &&
    aliasSpelling.toLowerCase() !== trimmed.toLowerCase() &&
    input.saveAlias
  ) {
    await input.saveAlias({
      entityType: 'artist',
      canonicalId: input.artist.id,
      aliasType: 'manual',
      aliasValue: aliasSpelling,
      sourceId: input.sourceId,
      createdAt: new Date().toISOString(),
      metadata: { reason: 'source_spelling_preservation', phase: '4.6.9' },
    });
    aliasCreated = true;
  }

  return {
    updated: true,
    artistId: input.artist.id,
    previousName,
    nextName: trimmed,
    aliasCreated,
  };
}
