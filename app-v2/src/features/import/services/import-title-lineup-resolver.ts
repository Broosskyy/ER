import type { ArtistRecord } from '@/data/types/records';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import {
  evaluateArtistCandidate,
  filterArtistCandidatesThroughGate,
} from '@/features/events/domain/artist-candidate-quality-gate';
import { artistMatchingService } from '@/features/import/matching/artist-matching-service';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import { matchingConfig } from '@/features/import/matching/matching-config';
import { capArtistIdSlug, normalizeMatchText, slugifyMatchText } from '@/features/import/matching/matching-utils';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

import { readLineupMetadata } from './import-lineup-from-record';

export type LineupCompleteness = 'none' | 'partial' | 'full';
export type LineupArtistSource = 'structured' | 'title_inference' | 'mixed';

export interface TitleLineupResolution {
  artistIds: string[];
  titleDerivedNames: string[];
  completeness: LineupCompleteness;
  source: LineupArtistSource;
  createdArtistIds: string[];
}

export const TITLE_LINEUP_SAFE_MATCH_THRESHOLD = 95;

function readLineupMetadataFromRecord(record: ImportRecord): {
  lineupEntries?: unknown[];
  detailBlocked?: boolean;
} {
  return readLineupMetadata(record);
}

export function resolveLineupCompleteness(record: ImportRecord): LineupCompleteness {
  const { lineupEntries, detailBlocked } = readLineupMetadataFromRecord(record);
  if (!detailBlocked && lineupEntries && lineupEntries.length > 0) {
    return 'full';
  }
  const title = getEffectiveCandidate(record).title ?? '';
  const titleArtists = extractArtistsFromEventTitle(title) ?? [];
  return titleArtists.length > 0 ? 'partial' : 'none';
}

export function extractTitleDerivedArtistNames(record: ImportRecord): string[] {
  const candidate = getEffectiveCandidate(record);
  return extractArtistsFromEventTitle(candidate.title ?? '') ?? [];
}

function findExactCatalogArtistId(name: string, catalog: MatchingCatalog): string | undefined {
  const normalized = normalizeMatchText(name);
  const exact = catalog.artists.find((artist) => normalizeMatchText(artist.name) === normalized);
  return exact?.id;
}

function findExactStoredArtistId(name: string, artists: ArtistRecord[]): string | undefined {
  const normalized = normalizeMatchText(name);
  const exact = artists.find(
    (artist) =>
      !artist.lineupLegacyArtifact && normalizeMatchText(artist.name) === normalized,
  );
  return exact?.id;
}

function buildTitleInferredArtist(name: string, sourceId: string): ArtistRecord {
  const now = new Date().toISOString();
  const slugBase = capArtistIdSlug(slugifyMatchText(name) || 'artist');
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `artist-title-${slugBase}-${suffix}`,
    name: name.trim(),
    slug: `${slugBase.slice(0, 48)}-${Math.random().toString(36).slice(2, 6)}`,
    genreIds: [],
    status: 'published',
    verificationStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
    bio: `Title-inferred artist candidate from ${sourceId}.`,
  };
}

function matchTitleArtist(
  name: string,
  candidate: NormalizedEventCandidate,
  catalog: MatchingCatalog,
): { artistId?: string; confidenceScore: number; matchType: 'exact' | 'probable' | 'none' } {
  const exactId = findExactCatalogArtistId(name, catalog);
  if (exactId) {
    return { artistId: exactId, confidenceScore: 100, matchType: 'exact' };
  }

  const [match] = artistMatchingService.match(
    { ...candidate, artistNames: [name] },
    catalog,
  );
  return {
    artistId: match?.artistId,
    confidenceScore: match?.confidenceScore ?? 0,
    matchType: match?.matchType ?? 'none',
  };
}

const MAX_UNVERIFIED_LINEUP_CREATES = 15;

export async function resolveArtistIdsForNames(input: {
  names: string[];
  record: ImportRecord;
  catalog: MatchingCatalog;
  allArtists: ArtistRecord[];
  saveArtist: (artist: ArtistRecord) => Promise<ArtistRecord>;
  /** When true, create unverified artists for unmatched structured source names (not title-only inference). */
  createUnverifiedForUnmatched?: boolean;
  maxCreates?: number;
}): Promise<TitleLineupResolution> {
  const candidate = getEffectiveCandidate(input.record);
  const knownCanonicalNames = [
    ...input.catalog.artists.map((artist) => artist.name),
    ...input.allArtists.map((artist) => artist.name),
  ];
  const gatedNames = filterArtistCandidatesThroughGate(input.names, {
    sourceField: 'lineup',
    extractionStrategy: input.createUnverifiedForUnmatched ? 'structured' : 'title_inference',
    knownCanonicalNames,
    eventTitle: candidate.title,
  });
  const artistIds: string[] = [];
  const createdArtistIds: string[] = [];

  for (const name of gatedNames) {
    const gate = evaluateArtistCandidate({
      name,
      sourceField: 'lineup',
      extractionStrategy: input.createUnverifiedForUnmatched ? 'structured' : 'title_inference',
      knownCanonicalNames,
      eventTitle: candidate.title,
    });
    if (gate.decision === 'invalid') {
      continue;
    }
    if (isLineupPlaceholderArtist(name)) {
      continue;
    }
    const storedExactId = findExactStoredArtistId(name, input.allArtists);
    if (storedExactId) {
      artistIds.push(storedExactId);
      continue;
    }

    const match = matchTitleArtist(name, candidate, input.catalog);
    if (match.artistId && match.confidenceScore >= TITLE_LINEUP_SAFE_MATCH_THRESHOLD) {
      artistIds.push(match.artistId);
      continue;
    }

    if (match.confidenceScore >= matchingConfig.minArtistConfidence && match.artistId) {
      artistIds.push(match.artistId);
      continue;
    }

    const maxCreates = input.maxCreates ?? MAX_UNVERIFIED_LINEUP_CREATES;
    const canCreateMore = createdArtistIds.length < maxCreates;
    const unmatched =
      !match.artistId || match.confidenceScore < TITLE_LINEUP_SAFE_MATCH_THRESHOLD;
    const shouldCreateStructured =
      input.createUnverifiedForUnmatched === true && canCreateMore && unmatched && gate.decision === 'valid';
    const shouldCreateTitleInference =
      !input.createUnverifiedForUnmatched &&
      match.matchType === 'none' &&
      gatedNames.length <= 2 &&
      gate.decision === 'valid';

    if (shouldCreateStructured || shouldCreateTitleInference) {
      const draft = await input.saveArtist(buildTitleInferredArtist(name, input.record.sourceId));
      createdArtistIds.push(draft.id);
      artistIds.push(draft.id);
      input.allArtists.push(draft);
      input.catalog.artists.push({ id: draft.id, name: draft.name });
    }
  }

  return {
    artistIds: [...new Set(artistIds)],
    titleDerivedNames: gatedNames,
    completeness: 'none',
    source: 'structured',
    createdArtistIds,
  };
}

export async function resolveTitleLineupArtistIds(input: {
  record: ImportRecord;
  catalog: MatchingCatalog;
  allArtists: ArtistRecord[];
  saveArtist: (artist: ArtistRecord) => Promise<ArtistRecord>;
}): Promise<TitleLineupResolution> {
  const candidate = getEffectiveCandidate(input.record);
  const completeness = resolveLineupCompleteness(input.record);
  const titleDerivedNames = extractTitleDerivedArtistNames(input.record);

  if (titleDerivedNames.length === 0) {
    return {
      artistIds: [],
      titleDerivedNames,
      completeness,
      source: 'structured',
      createdArtistIds: [],
    };
  }

  const resolved = await resolveArtistIdsForNames({
    names: titleDerivedNames,
    record: input.record,
    catalog: input.catalog,
    allArtists: input.allArtists,
    saveArtist: input.saveArtist,
  });

  return {
    ...resolved,
    completeness: completeness === 'full' ? 'partial' : completeness,
    source: 'title_inference',
  };
}
