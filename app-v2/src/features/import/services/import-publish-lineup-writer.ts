import type { ArtistRecord } from '@/data/types/records';
import type { EventLineupService } from '@/features/events/services/event-lineup-service';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { ImportRecord } from '@/features/import/models/types';
import { writeImportStructuredLineup } from '@/features/import/services/import-publish-structured-lineup-writer';
import { writeExplicitStructuredLineup } from '@/features/import/services/import-publish-explicit-structured-lineup-writer';
import { importRecordMayContributeLineup } from '@/features/import/matching/event-ownership-decision';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { buildTitleInferenceCandidates } from '@/features/import/services/title-inference-candidate';
import type {
  LineupArtistSource,
  LineupCompleteness,
} from '@/features/import/services/import-title-lineup-resolver';

export interface ImportPublishLineupResult {
  wroteLineup: boolean;
  artistIds: string[];
  completeness: LineupCompleteness;
  source: LineupArtistSource;
  createdArtistIds: string[];
  titleDerivedNames: string[];
}

export async function writeImportPublishLineup(input: {
  lineupService?: Pick<
    EventLineupService,
    | 'getLineupArtistIds'
    | 'replaceStructuredLineupFromImport'
    | 'getStructuredLineupForEvent'
  >;
  record: ImportRecord;
  eventId: string;
  eventTitle?: string;
  eventTicketUrl?: string;
  eventWebsiteUrl?: string;
  catalog?: MatchingCatalog;
  allArtists?: ArtistRecord[];
  saveArtist?: (artist: ArtistRecord) => Promise<ArtistRecord>;
}): Promise<ImportPublishLineupResult> {
  const base: ImportPublishLineupResult = {
    wroteLineup: false,
    artistIds: [],
    completeness: 'none',
    source: 'structured',
    createdArtistIds: [],
    titleDerivedNames: [],
  };

  if (!input.lineupService) {
    return base;
  }

  const candidate = getEffectiveCandidate(input.record);
  if (
    input.eventTitle &&
    !importRecordMayContributeLineup({
      recordTitle: candidate.title ?? '',
      recordExternalUrls: [
        input.record.sourceUrl,
        candidate.externalId,
        candidate.ticketUrl,
        candidate.eventUrl,
        candidate.originalLink,
      ].filter((url): url is string => Boolean(url)),
      eventTitle: input.eventTitle,
      eventTicketUrl: input.eventTicketUrl,
      eventWebsiteUrl: input.eventWebsiteUrl,
    })
  ) {
    return base;
  }

  const structuredResult = await writeImportStructuredLineup({
    lineupService: input.lineupService,
    record: input.record,
    eventId: input.eventId,
    catalog: input.catalog,
    allArtists: input.allArtists,
    saveArtist: input.saveArtist,
  });

  if (structuredResult.wroteLineup) {
    return {
      wroteLineup: structuredResult.wroteLineup,
      artistIds: structuredResult.artistIds,
      completeness: structuredResult.completeness,
      source: structuredResult.source,
      createdArtistIds: structuredResult.createdArtistIds,
      titleDerivedNames: [],
    };
  }

  if (structuredResult.entries.length > 0) {
    return {
      wroteLineup: false,
      artistIds: structuredResult.artistIds,
      completeness: structuredResult.completeness,
      source: structuredResult.source,
      createdArtistIds: structuredResult.createdArtistIds,
      titleDerivedNames: [],
    };
  }

  const existingStructured = await input.lineupService.getStructuredLineupForEvent(input.eventId);
  if (existingStructured.length > 0) {
    const existingArtistIds = await input.lineupService.getLineupArtistIds(input.eventId);
    return {
      wroteLineup: false,
      artistIds: existingArtistIds,
      completeness: 'full',
      source: 'structured',
      createdArtistIds: [],
      titleDerivedNames: [],
    };
  }

  const titleCandidates = buildTitleInferenceCandidates(input.record);
  if (
    titleCandidates.entries.length > 0 &&
    input.catalog &&
    input.allArtists &&
    input.saveArtist
  ) {
    const titleResult = await writeExplicitStructuredLineup({
      lineupService: input.lineupService,
      record: input.record,
      eventId: input.eventId,
      entries: titleCandidates.entries,
      completeness: titleCandidates.completeness,
      source: 'title_inference',
      catalog: input.catalog,
      allArtists: input.allArtists,
      saveArtist: input.saveArtist,
    });

    if (titleResult.wroteLineup || titleResult.entries.length > 0) {
      return {
        wroteLineup: titleResult.wroteLineup,
        artistIds: titleResult.artistIds,
        completeness: titleCandidates.completeness,
        source: 'title_inference',
        createdArtistIds: titleResult.createdArtistIds,
        titleDerivedNames: titleCandidates.entries.flatMap((entry) => entry.artists),
      };
    }
  }

  return base;
}
