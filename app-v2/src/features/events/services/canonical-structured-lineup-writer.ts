import { AppError } from '@/core/errors/app-error';
import type { ArtistRecord } from '@/data/types/records';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import {
  buildCompatibilityProjectionFromStructured,
  compatibilityProjectionMatches,
} from '@/features/events/domain/lineup-compatibility-projection';
import { needsStructuredLineupReplace } from '@/features/import/services/structured-lineup-replace-decision';

export type CanonicalLineupWriteSource =
  | 'import'
  | 'cms'
  | 'moderation'
  | 'repair'
  | 'compatibility_sync';

export interface CanonicalLineupWriteContext {
  source: CanonicalLineupWriteSource;
  importRecordId?: string;
  forceReplace?: boolean;
}

export interface CanonicalLineupWriteRepositories {
  getEntriesForEvent(eventId: string): Promise<ResolvedCanonicalLineupEntry[]>;
  replaceEventLineupEntries(
    eventId: string,
    entries: ResolvedCanonicalLineupEntry[],
  ): Promise<ResolvedCanonicalLineupEntry[]>;
  getLineupArtistIds(eventId: string): Promise<string[]>;
  replaceEventLineup(eventId: string, lineup: EventLineupInput[]): Promise<unknown>;
}

export interface CanonicalLineupWriteResult {
  wroteStructured: boolean;
  wroteProjection: boolean;
  entries: ResolvedCanonicalLineupEntry[];
  projectedArtistIds: string[];
}

function validateEntries(entries: ResolvedCanonicalLineupEntry[]): void {
  for (const entry of entries) {
    if (entry.artistIds.length === 0) {
      throw new AppError('Structured lineup entry must resolve at least one artist.', {
        code: 'VALIDATION',
      });
    }
  }
}

/**
 * Single authoritative writer for canonical structured lineup state.
 * Mutates `event_lineup_entries`, `event_lineup_entry_artists`, and derived `event_artists`.
 */
export async function writeCanonicalStructuredLineup(input: {
  eventId: string;
  entries: ResolvedCanonicalLineupEntry[];
  context: CanonicalLineupWriteContext;
  repositories: CanonicalLineupWriteRepositories;
  artistsById?: Map<string, Pick<ArtistRecord, 'lineupLegacyArtifact'>>;
  existingEntries?: ResolvedCanonicalLineupEntry[];
}): Promise<CanonicalLineupWriteResult> {
  const existingEntries =
    input.existingEntries ?? (await input.repositories.getEntriesForEvent(input.eventId));
  const existingArtistIds = await input.repositories.getLineupArtistIds(input.eventId);

  validateEntries(input.entries);

  const isClearing = input.entries.length === 0 && existingEntries.length > 0;
  const structuredUnchanged =
    !input.context.forceReplace &&
    !isClearing &&
    !needsStructuredLineupReplace(existingEntries, input.entries);

  const projection = buildCompatibilityProjectionFromStructured(input.entries, {
    artistsById: input.artistsById,
  });
  const projectedArtistIds = projection.map((row) => row.artistId);
  const projectionUnchanged = compatibilityProjectionMatches(projection, existingArtistIds);

  if (structuredUnchanged && projectionUnchanged) {
    return {
      wroteStructured: false,
      wroteProjection: false,
      entries: existingEntries.length > 0 ? existingEntries : input.entries,
      projectedArtistIds: existingArtistIds,
    };
  }

  let savedEntries = input.entries;
  let wroteStructured = false;

  if (!structuredUnchanged) {
    savedEntries = await input.repositories.replaceEventLineupEntries(
      input.eventId,
      input.entries,
    );
    wroteStructured = true;
  } else {
    savedEntries = existingEntries;
  }

  const nextProjection = buildCompatibilityProjectionFromStructured(savedEntries, {
    artistsById: input.artistsById,
  });
  const nextArtistIds = nextProjection.map((row) => row.artistId);
  const nextProjectionUnchanged = compatibilityProjectionMatches(nextProjection, existingArtistIds);

  let wroteProjection = false;
  if (!nextProjectionUnchanged) {
    await input.repositories.replaceEventLineup(input.eventId, nextProjection);
    wroteProjection = true;
  }

  return {
    wroteStructured,
    wroteProjection,
    entries: savedEntries,
    projectedArtistIds: wroteProjection ? nextArtistIds : existingArtistIds,
  };
}

/** Regenerate compatibility projection from existing structured entries without mutating structured tables. */
export async function syncCompatibilityProjectionFromStructured(input: {
  eventId: string;
  repositories: CanonicalLineupWriteRepositories;
  artistsById?: Map<string, Pick<ArtistRecord, 'lineupLegacyArtifact'>>;
}): Promise<CanonicalLineupWriteResult> {
  const existingEntries = await input.repositories.getEntriesForEvent(input.eventId);
  return writeCanonicalStructuredLineup({
    eventId: input.eventId,
    entries: existingEntries,
    context: { source: 'compatibility_sync', forceReplace: true },
    repositories: input.repositories,
    artistsById: input.artistsById,
    existingEntries,
  });
}
