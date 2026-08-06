import type {
  CanonicalLineupEntry,
  LineupEntryProvenance,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  dedupeCanonicalLineupEntries,
  groupStructuredLineupEntries,
  parseLineupLineToCanonicalEntries,
  soloEntriesFromArtistNames,
} from '@/features/aggregation/domain/lineup-entry-builder';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import type { StructuredLineupEntry } from '@/features/aggregation/domain/structured-lineup';
import { parseFlyerTextToCanonicalEntries } from '@/features/aggregation/domain/flyer-lineup-to-canonical';
import { isLineupPlaceholderArtist, sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { filterArtistCandidatesThroughGate } from '@/features/events/domain/artist-candidate-quality-gate';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { readLineupMetadata } from '@/features/import/services/import-lineup-from-record';
import {
  isPublishableFlyerEvidence,
  readFlyerLineupEvidence,
} from '@/features/import/services/flyer-evidence-metadata';
import type { LineupArtistSource, LineupCompleteness } from '@/features/import/services/import-title-lineup-resolver';

interface LineupEntryLike {
  displayName?: string;
  normalizedName?: string;
  source?: string;
  confidence?: number;
  role?: string;
  headliner?: boolean;
  isB2b?: boolean;
  isF2f?: boolean;
  isLiveSet?: boolean;
  stageOrFloor?: string;
  startTime?: string;
  endTime?: string;
  sortOrder?: number;
}

function toStructuredLineupEntry(
  entry: LineupEntryLike,
  index: number,
): StructuredLineupEntry | null {
  const displayName = entry.displayName?.trim();
  if (!displayName) {
    return null;
  }
  return {
    displayName,
    normalizedName: entry.normalizedName ?? displayName.toLowerCase(),
    role: entry.role,
    headliner: entry.headliner,
    isB2b: entry.isB2b,
    isF2f: entry.isF2f,
    isLiveSet: entry.isLiveSet,
    stageOrFloor: entry.stageOrFloor,
    startTime: entry.startTime,
    endTime: entry.endTime,
    source: (entry.source as StructuredLineupEntry['source']) ?? 'structured',
    confidence: entry.confidence ?? 0.75,
    sortOrder: entry.sortOrder ?? index,
  };
}

function entriesFromMetadataLineup(
  lineupEntries: LineupEntryLike[],
  provenance?: LineupEntryProvenance,
): CanonicalLineupEntry[] {
  const structured = lineupEntries
    .map((entry, index) => toStructuredLineupEntry(entry, index))
    .filter((entry): entry is StructuredLineupEntry => entry !== null);

  if (structured.length === 0) {
    return [];
  }

  const grouped = groupStructuredLineupEntries(structured);
  if (grouped.length > 0) {
    return grouped.map((entry) => ({
      ...entry,
      provenance: entry.provenance ?? provenance,
    }));
  }

  return soloEntriesFromArtistNames(
    structured.map((entry) => entry.displayName),
    { provenance, confidence: structured[0]?.confidence },
  );
}

function entriesFromDescription(
  description: string,
  provenance?: LineupEntryProvenance,
): CanonicalLineupEntry[] {
  const names = extractLineupNamesFromDescriptionText(description) ?? [];
  const gated = filterArtistCandidatesThroughGate(names, {
    sourceField: 'description',
    extractionStrategy: 'html_lineup',
  });
  if (gated.length === 0) {
    return [];
  }

  const entries: CanonicalLineupEntry[] = [];
  let order = 0;
  for (const name of gated) {
    const parsed = parseLineupLineToCanonicalEntries(name, {
      orderOffset: order,
      provenance,
      confidence: 0.75,
    });
    for (const entry of parsed) {
      entries.push({ ...entry, order });
      order += 1;
    }
  }
  return dedupeCanonicalLineupEntries(entries);
}

function metadataLineupLooksLikeDescriptionOverflow(input: {
  lineupEntries: LineupEntryLike[];
  rawArtistNames: string[];
}): boolean {
  if (input.rawArtistNames.length === 0) {
    return false;
  }
  const htmlOnly = input.lineupEntries.every((entry) => entry.source === 'html_lineup');
  return htmlOnly && input.lineupEntries.length > input.rawArtistNames.length * 2;
}

function isSkippableArtistNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (/\b(?:b2b|f2f|vs\.?)\b/i.test(trimmed)) {
    return false;
  }
  return isLineupPlaceholderArtist(trimmed);
}

function entriesFromArtistNameLines(
  names: string[],
  provenance?: LineupEntryProvenance,
): CanonicalLineupEntry[] {
  const entries: CanonicalLineupEntry[] = [];
  let order = 0;
  for (const rawName of names) {
    const line = rawName.trim();
    if (!line || isSkippableArtistNameLine(line)) {
      continue;
    }
    const parsed = parseLineupLineToCanonicalEntries(line, {
      orderOffset: order,
      provenance,
      confidence: 0.8,
    });
    for (const entry of parsed) {
      const artists = entry.artists
        .map((name) => name.trim())
        .filter((name) => name && !isLineupPlaceholderArtist(name));
      if (artists.length === 0) {
        continue;
      }
      entries.push({ ...entry, artists, order });
      order += 1;
    }
  }
  return dedupeCanonicalLineupEntries(entries);
}

/** Extract structured lineup entries from import record without flattening billing. */
export function extractPrioritizedLineupEntries(record: ImportRecord): {
  entries: CanonicalLineupEntry[];
  completeness: LineupCompleteness;
  source: LineupArtistSource;
} {
  const candidate = getEffectiveCandidate(record);
  const { lineupEntries, detailBlocked } = readLineupMetadata(record);
  const provenance: LineupEntryProvenance = {
    source: 'structured',
    importRecordId: record.id,
    connector: (candidate.sourceMetadata as { connector?: string } | undefined)?.connector,
    sourceUrl: candidate.sourceUrl ?? candidate.eventUrl,
  };

  const flyerEvidence = readFlyerLineupEvidence(record);
  if (isPublishableFlyerEvidence(flyerEvidence)) {
    const flyerProvenance: LineupEntryProvenance = {
      ...provenance,
      connector: 'official_flyer',
      sourceUrl: flyerEvidence.imageUrl,
      extractedAt: flyerEvidence.extractedAt,
    };
    const flyerEntries = parseFlyerTextToCanonicalEntries(flyerEvidence.rawText, {
      provenance: flyerProvenance,
      confidence: flyerEvidence.confidence,
    });
    if (flyerEntries.length > 0) {
      const textualEntries = !detailBlocked && lineupEntries && lineupEntries.length > 0
        ? entriesFromMetadataLineup(lineupEntries, provenance)
        : entriesFromArtistNameLines(candidate.artistNames ?? [], provenance);
      const flyerHasRichBilling = flyerEntries.some((entry) => entry.billingRelation !== 'SOLO');

      const textualArtistCount = textualEntries.reduce((sum, entry) => sum + entry.artists.length, 0);
      const flyerArtistCount = flyerEntries.reduce((sum, entry) => sum + entry.artists.length, 0);
      const textualCollapsed =
        textualEntries.length > 0 &&
        textualEntries.every((entry) => entry.billingRelation === 'SOLO') &&
        (textualEntries.some((entry) =>
          entry.artists.some((name) => isCollapsedLineupArtistName(name)),
        ) ||
          (flyerHasRichBilling && flyerArtistCount > textualArtistCount));
      const acceptedFlyerAuthoritative =
        flyerEvidence.reviewState === 'accepted' &&
        flyerHasRichBilling &&
        (textualEntries.length === 0 || textualCollapsed || flyerEntries.length >= textualEntries.length);
      if (acceptedFlyerAuthoritative) {
        return {
          entries: flyerEntries,
          completeness: 'full',
          source: 'structured',
        };
      }
      if (textualEntries.length === 0 || textualCollapsed || flyerEntries.length >= textualEntries.length) {
        return {
          entries: flyerEntries,
          completeness: 'full',
          source: 'structured',
        };
      }
    }
  }

  if (!detailBlocked && lineupEntries && lineupEntries.length > 0) {
    if (
      !metadataLineupLooksLikeDescriptionOverflow({
        lineupEntries,
        rawArtistNames: candidate.artistNames ?? [],
      })
    ) {
      const entries = entriesFromMetadataLineup(lineupEntries, provenance);
      if (entries.length > 0) {
        const hasStructured = lineupEntries.some((entry) => entry.source !== 'title');
        return {
          entries,
          completeness: entries.length > 2 ? 'full' : entries.length === 1 ? 'partial' : 'full',
          source: hasStructured ? 'structured' : 'mixed',
        };
      }
    }
  }

  const rawArtistNames = candidate.artistNames ?? [];
  if (rawArtistNames.length > 0) {
    const entries = entriesFromArtistNameLines(rawArtistNames, provenance);
    if (entries.length > 0) {
      return {
        entries,
        completeness: entries.length > 2 ? 'full' : entries.length === 1 ? 'partial' : 'full',
        source: 'structured',
      };
    }
  }

  const candidateNames = sanitizeLineupArtistNames(candidate.artistNames ?? []) ?? [];
  if (candidateNames.length > 0) {
    const entries = entriesFromArtistNameLines(candidateNames, provenance);
    const deduped = dedupeCanonicalLineupEntries(entries);
    if (deduped.length > 0) {
      return {
        entries: deduped,
        completeness: deduped.length > 2 ? 'full' : deduped.length === 1 ? 'partial' : 'full',
        source: 'structured',
      };
    }
  }

  if (candidate.description) {
    const entries = entriesFromDescription(candidate.description, {
      ...provenance,
      source: 'html_lineup',
    });
    if (entries.length > 0) {
      return {
        entries,
        completeness: entries.length > 2 ? 'full' : 'partial',
        source: 'structured',
      };
    }
  }

  return { entries: [], completeness: 'none', source: 'structured' };
}
