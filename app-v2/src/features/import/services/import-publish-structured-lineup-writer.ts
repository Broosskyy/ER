import type { ArtistRecord } from '@/data/types/records';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { EventLineupService } from '@/features/events/services/event-lineup-service';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { ImportRecord } from '@/features/import/models/types';
import { writeExplicitStructuredLineup } from '@/features/import/services/import-publish-explicit-structured-lineup-writer';
import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import type {
  LineupArtistSource,
  LineupCompleteness,
} from '@/features/import/services/import-title-lineup-resolver';

export interface ImportStructuredLineupResult {
  wroteLineup: boolean;
  entries: ResolvedCanonicalLineupEntry[];
  artistIds: string[];
  completeness: LineupCompleteness;
  source: LineupArtistSource;
  createdArtistIds: string[];
}

export async function writeImportStructuredLineup(input: {
  lineupService?: Pick<
    EventLineupService,
    | 'replaceStructuredLineupFromImport'
    | 'getLineupArtistIds'
    | 'getStructuredLineupForEvent'
  >;
  record: ImportRecord;
  eventId: string;
  catalog?: MatchingCatalog;
  allArtists?: ArtistRecord[];
  saveArtist?: (artist: ArtistRecord) => Promise<ArtistRecord>;
}): Promise<ImportStructuredLineupResult> {
  const base: ImportStructuredLineupResult = {
    wroteLineup: false,
    entries: [],
    artistIds: [],
    completeness: 'none',
    source: 'structured',
    createdArtistIds: [],
  };

  if (!input.lineupService || !input.catalog || !input.allArtists || !input.saveArtist) {
    return base;
  }

  const prioritized = extractPrioritizedLineupEntries(input.record);
  if (prioritized.entries.length === 0) {
    return { ...base, completeness: prioritized.completeness, source: prioritized.source };
  }

  return writeExplicitStructuredLineup({
    lineupService: input.lineupService,
    record: input.record,
    eventId: input.eventId,
    entries: prioritized.entries,
    completeness: prioritized.completeness,
    source: prioritized.source,
    catalog: input.catalog,
    allArtists: input.allArtists,
    saveArtist: input.saveArtist,
  });
}
