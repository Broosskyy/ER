import type { CanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  groupStructuredLineupEntries,
  parseLineupLineToCanonicalEntries,
  soloEntriesFromArtistNames,
} from '@/features/aggregation/domain/lineup-entry-builder';
import type { StructuredLineupEntry } from '@/features/aggregation/domain/structured-lineup';

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

function toStructuredLineupEntry(entry: LineupEntryLike, index: number): StructuredLineupEntry | null {
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

/** Extract grouped canonical lineup entries from connector source metadata. */
export function extractCanonicalLineupEntriesFromSourceMetadata(
  sourceMetadata?: Record<string, unknown>,
  artistNames?: string[],
): CanonicalLineupEntry[] {
  const rawEntries = sourceMetadata?.lineupEntries;
  if (Array.isArray(rawEntries) && rawEntries.length > 0) {
    const structured = (rawEntries as LineupEntryLike[])
      .map((entry, index) => toStructuredLineupEntry(entry, index))
      .filter((entry): entry is StructuredLineupEntry => entry !== null);
    if (structured.length > 0) {
      const grouped = groupStructuredLineupEntries(structured);
      if (grouped.length > 0) {
        return grouped;
      }
    }
  }

  const names = (artistNames ?? []).map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) {
    return [];
  }

  const entries: CanonicalLineupEntry[] = [];
  let order = 0;
  for (const name of names) {
    const parsed = parseLineupLineToCanonicalEntries(name, { orderOffset: order, confidence: 0.8 });
    for (const entry of parsed) {
      entries.push({ ...entry, order });
      order += 1;
    }
  }
  if (entries.length > 0) {
    return entries;
  }

  return soloEntriesFromArtistNames(names, { confidence: 0.8 });
}
