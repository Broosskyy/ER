import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import {
  expandSegmentedLineupNames,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { sanitizeLineupArtistNames, isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

import type { LineupArtistSource, LineupCompleteness } from './import-title-lineup-resolver';

interface LineupEntryLike {
  displayName?: string;
  normalizedName?: string;
  source?: string;
  confidence?: number;
}

const STRUCTURED_LINEUP_SOURCES = new Set([
  'json_ld',
  'html_lineup',
  'structured',
  'source_lineup',
]);

export function readLineupMetadata(record: ImportRecord): {
  lineupEntries?: LineupEntryLike[];
  detailBlocked?: boolean;
} {
  const metadata = (getEffectiveCandidate(record).sourceMetadata ?? {}) as Record<string, unknown>;
  const detail = metadata.detailEnrichment as Record<string, unknown> | undefined;
  const lineupEntries = metadata.lineupEntries ?? detail?.lineupEntries;
  return {
    lineupEntries: Array.isArray(lineupEntries) ? (lineupEntries as LineupEntryLike[]) : undefined,
    detailBlocked: detail?.blockedByPow === true,
  };
}

function dedupeArtistNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || isLineupPlaceholderArtist(trimmed)) {
      continue;
    }
    const key = normalizeMatchText(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function extractNamesFromLineupEntries(entries: LineupEntryLike[]): string[] {
  const sorted = [...entries].sort((left, right) => {
    const leftStructured = STRUCTURED_LINEUP_SOURCES.has(left.source ?? '') ? 1 : 0;
    const rightStructured = STRUCTURED_LINEUP_SOURCES.has(right.source ?? '') ? 1 : 0;
    if (leftStructured !== rightStructured) {
      return rightStructured - leftStructured;
    }
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  });

  return dedupeArtistNames(
    expandSegmentedLineupNames(
      sorted.map((entry) => entry.displayName?.trim() ?? '').filter(Boolean),
    ),
  );
}

function inferCompletenessFromNames(
  names: string[],
  title: string,
  hasStructuredSource: boolean,
): LineupCompleteness {
  if (names.length === 0) {
    return 'none';
  }
  if (names.length === 1 && hasStructuredSource) {
    return 'full';
  }
  if (names.length > 2) {
    return 'full';
  }
  if (hasStructuredSource) {
    return 'full';
  }
  const titleArtists = extractArtistsFromEventTitle(title) ?? [];
  const isTitleOnly =
    names.length === 1 &&
    titleArtists.length === 1 &&
    names[0] &&
    titleArtists[0] &&
    normalizeMatchText(names[0]) === normalizeMatchText(titleArtists[0]);
  return isTitleOnly ? 'partial' : names.length === 1 ? 'partial' : 'full';
}

/**
 * Strict lineup priority for publish:
 * 1. lineupEntries from detail enrichment
 * 2. structured artistNames on candidate
 * 3. title inference (last resort — handled by title resolver when empty)
 */
export function extractPrioritizedArtistNames(record: ImportRecord): {
  names: string[];
  completeness: LineupCompleteness;
  source: LineupArtistSource;
} {
  const candidate = getEffectiveCandidate(record);
  const { lineupEntries, detailBlocked } = readLineupMetadata(record);

  if (!detailBlocked && lineupEntries && lineupEntries.length > 0) {
    const names = extractNamesFromLineupEntries(lineupEntries);
    const hasStructured = lineupEntries.some((entry) =>
      STRUCTURED_LINEUP_SOURCES.has(entry.source ?? ''),
    );
    const titleOnly =
      names.length > 0 &&
      lineupEntries.every((entry) => entry.source === 'title') &&
      !hasStructured;

    return {
      names,
      completeness: inferCompletenessFromNames(names, candidate.title ?? '', hasStructured),
      source: titleOnly ? 'title_inference' : hasStructured ? 'structured' : 'mixed',
    };
  }

  const candidateNames = sanitizeLineupArtistNames(dedupeArtistNames(candidate.artistNames ?? [])) ?? [];
  if (candidateNames.length > 0) {
    const titleArtists = extractArtistsFromEventTitle(candidate.title ?? '') ?? [];
    const isTitleOnly =
      candidateNames.length === 1 &&
      titleArtists.length === 1 &&
      candidateNames[0] &&
      titleArtists[0] &&
      normalizeMatchText(candidateNames[0]) === normalizeMatchText(titleArtists[0]);

    return {
      names: candidateNames,
      completeness: inferCompletenessFromNames(candidateNames, candidate.title ?? '', !isTitleOnly),
      source: isTitleOnly ? 'title_inference' : 'structured',
    };
  }

  const descriptionNames = extractLineupNamesFromDescriptionText(candidate.description ?? '');
  if (descriptionNames && descriptionNames.length > 0) {
    return {
      names: descriptionNames,
      completeness: inferCompletenessFromNames(descriptionNames, candidate.title ?? '', true),
      source: 'structured',
    };
  }

  const titleOnly = inferTitleOnlyLineup(record);
  return titleOnly ?? { names: [], completeness: 'none', source: 'structured' };
}

function inferTitleOnlyLineup(record: ImportRecord): {
  names: string[];
  completeness: LineupCompleteness;
  source: LineupArtistSource;
} | undefined {
  const candidate = getEffectiveCandidate(record);
  const titleArtists = extractArtistsFromEventTitle(candidate.title ?? '') ?? [];
  if (titleArtists.length === 0) {
    return undefined;
  }
  return {
    names: titleArtists,
    completeness: 'partial',
    source: 'title_inference',
  };
}
