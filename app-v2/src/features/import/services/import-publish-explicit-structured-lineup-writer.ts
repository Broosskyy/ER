import type { ArtistRecord } from '@/data/types/records';
import {
  flattenResolvedLineupArtistIds,
  type CanonicalLineupEntry,
  type ResolvedCanonicalLineupEntry,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import type { EventLineupService } from '@/features/events/services/event-lineup-service';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { ImportRecord } from '@/features/import/models/types';
import { needsStructuredLineupReplace } from '@/features/import/services/structured-lineup-replace-decision';
import { resolveArtistIdsForNames } from '@/features/import/services/import-title-lineup-resolver';
import type {
  LineupArtistSource,
  LineupCompleteness,
} from '@/features/import/services/import-title-lineup-resolver';
import type { ImportStructuredLineupResult } from '@/features/import/services/import-publish-structured-lineup-writer';

async function resolveEntryArtistIds(
  entry: CanonicalLineupEntry,
  input: {
    record: ImportRecord;
    catalog: MatchingCatalog;
    allArtists: ArtistRecord[];
    saveArtist: (artist: ArtistRecord) => Promise<ArtistRecord>;
  },
): Promise<{ artistIds: string[]; createdArtistIds: string[] }> {
  const resolved = await resolveArtistIdsForNames({
    names: entry.artists,
    record: input.record,
    catalog: input.catalog,
    allArtists: input.allArtists,
    saveArtist: input.saveArtist,
    createUnverifiedForUnmatched: true,
  });
  return {
    artistIds: resolved.artistIds,
    createdArtistIds: resolved.createdArtistIds,
  };
}

/** Resolve canonical entries and persist structured lineup + compatibility projection. */
export async function writeExplicitStructuredLineup(input: {
  lineupService?: Pick<
    EventLineupService,
    | 'replaceStructuredLineupFromImport'
    | 'getLineupArtistIds'
    | 'getStructuredLineupForEvent'
  >;
  record: ImportRecord;
  eventId: string;
  entries: CanonicalLineupEntry[];
  completeness?: LineupCompleteness;
  source?: LineupArtistSource;
  catalog?: MatchingCatalog;
  allArtists?: ArtistRecord[];
  saveArtist?: (artist: ArtistRecord) => Promise<ArtistRecord>;
  forceReplace?: boolean;
}): Promise<ImportStructuredLineupResult> {
  const base: ImportStructuredLineupResult = {
    wroteLineup: false,
    entries: [],
    artistIds: [],
    completeness: input.completeness ?? 'full',
    source: input.source ?? 'structured',
    createdArtistIds: [],
  };

  if (
    !input.lineupService ||
    !input.catalog ||
    !input.allArtists ||
    !input.saveArtist ||
    input.entries.length === 0
  ) {
    return base;
  }

  const resolvedEntries: ResolvedCanonicalLineupEntry[] = [];
  const createdArtistIds: string[] = [];

  for (const entry of input.entries) {
    const resolved = await resolveEntryArtistIds(entry, {
      record: input.record,
      catalog: input.catalog,
      allArtists: input.allArtists,
      saveArtist: input.saveArtist,
    });
    createdArtistIds.push(...resolved.createdArtistIds);
    if (resolved.artistIds.length === 0) {
      continue;
    }
    resolvedEntries.push({
      ...entry,
      artistIds: resolved.artistIds,
    });
  }

  if (resolvedEntries.length === 0) {
    return base;
  }

  const [existingArtistIds, existingStructuredEntries] = await Promise.all([
    input.lineupService.getLineupArtistIds(input.eventId),
    input.lineupService.getStructuredLineupForEvent(input.eventId),
  ]);
  const nextArtistIds = flattenResolvedLineupArtistIds(resolvedEntries);
  const flatUnchanged =
    nextArtistIds.length === existingArtistIds.length &&
    nextArtistIds.every((id, index) => id === existingArtistIds[index]);
  const structuredUnchanged =
    !input.forceReplace && !needsStructuredLineupReplace(existingStructuredEntries, resolvedEntries);

  if (flatUnchanged && structuredUnchanged) {
    return {
      wroteLineup: false,
      entries: resolvedEntries,
      artistIds: existingArtistIds,
      completeness: input.completeness ?? 'full',
      source: input.source ?? 'structured',
      createdArtistIds,
    };
  }

  const savedEntries = await input.lineupService.replaceStructuredLineupFromImport(
    input.eventId,
    resolvedEntries,
    { importRecordId: input.record.id, forceReplace: input.forceReplace },
  );

  return {
    wroteLineup: true,
    entries: savedEntries,
    artistIds: flattenResolvedLineupArtistIds(savedEntries),
    completeness: input.completeness ?? 'full',
    source: input.source ?? 'structured',
    createdArtistIds,
  };
}
