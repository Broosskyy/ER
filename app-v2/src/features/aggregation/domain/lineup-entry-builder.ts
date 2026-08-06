import {
  type BillingRelation,
  type CanonicalLineupEntry,
  type LineupEntryProvenance,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  expandLineupLine,
  splitLineupTextIntoLines,
  type BillingRelationship,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import type { StructuredLineupEntry } from '@/features/aggregation/domain/structured-lineup';

const HOSTED_BY_PATTERN = /^hosted\s+by\s*:?\s*(.+)$/i;
const SUPPORT_PATTERN = /^support\s*:?\s*(.+)$/i;
const LIVE_PATTERN = /^live\s*:?\s*(.+)$/i;
const SPECIAL_GUEST_PATTERN = /^special\s+guests?\s*:?\s*(.*)$/i;

function toBillingRelation(relationship?: BillingRelationship, flags?: {
  isLiveSet?: boolean;
  role?: string;
}): BillingRelation {
  if (flags?.role === 'support') {
    return 'SUPPORT';
  }
  if (flags?.role === 'hosted_by' || flags?.role === 'hosted by') {
    return 'HOSTED_BY';
  }
  if (flags?.isLiveSet || flags?.role === 'live') {
    return 'LIVE';
  }
  switch (relationship) {
    case 'b2b':
      return 'B2B';
    case 'f2f':
      return 'F2F';
    case 'vs':
      return 'VS';
    case 'live':
      return 'LIVE';
    case 'support':
      return 'SUPPORT';
    case 'hosted_by':
      return 'HOSTED_BY';
    default:
      return 'SOLO';
  }
}

function detectRelationshipFromLine(line: string): BillingRelationship | undefined {
  const lower = line.toLowerCase();
  if (/\bf2f\b/.test(lower)) {
    return 'f2f';
  }
  if (/\bb2b\b/.test(lower)) {
    return 'b2b';
  }
  if (/\bvs\.?\b/.test(lower)) {
    return 'vs';
  }
  return undefined;
}

function titleCasePreserve(token: string): string {
  return token.trim().replace(/\s+/g, ' ');
}

/** Parse one lineup line into one or more grouped canonical entries. */
export function parseLineupLineToCanonicalEntries(
  line: string,
  options?: {
    orderOffset?: number;
    provenance?: LineupEntryProvenance;
    confidence?: number;
    stage?: string;
    startTime?: string;
    endTime?: string;
    runningOrder?: number;
  },
): CanonicalLineupEntry[] {
  const body = line.trim();
  if (!body) {
    return [];
  }

  const base = {
    stage: options?.stage,
    startTime: options?.startTime,
    endTime: options?.endTime,
    runningOrder: options?.runningOrder,
    confidence: options?.confidence,
    provenance: options?.provenance,
  };
  const orderOffset = options?.orderOffset ?? 0;

  const hostedMatch = body.match(HOSTED_BY_PATTERN);
  if (hostedMatch?.[1]?.trim()) {
    return [
      {
        ...base,
        order: orderOffset,
        artists: [titleCasePreserve(hostedMatch[1])],
        billingRelation: 'HOSTED_BY',
      },
    ];
  }

  const supportMatch = body.match(SUPPORT_PATTERN);
  if (supportMatch?.[1]?.trim()) {
    return [
      {
        ...base,
        order: orderOffset,
        artists: [titleCasePreserve(supportMatch[1])],
        billingRelation: 'SUPPORT',
      },
    ];
  }

  const liveMatch = body.match(LIVE_PATTERN);
  if (liveMatch?.[1]?.trim()) {
    const liveBody = liveMatch[1].trim();
    const relationship = detectRelationshipFromLine(liveBody);
    if (relationship) {
      const expanded = expandLineupLine(`live: ${liveBody}`);
      const artists = expanded.map((entry) => entry.displayName).filter(Boolean);
      if (artists.length > 1) {
        return [
          {
            ...base,
            order: orderOffset,
            artists,
            billingRelation: toBillingRelation(relationship, { isLiveSet: true, role: 'live' }),
          },
        ];
      }
    }
    return [
      {
        ...base,
        order: orderOffset,
        artists: [titleCasePreserve(liveBody)],
        billingRelation: 'LIVE',
      },
    ];
  }

  const specialGuestMatch = body.match(SPECIAL_GUEST_PATTERN);
  if (specialGuestMatch) {
    const guestBody = specialGuestMatch[1]?.trim();
    if (!guestBody) {
      return [{ ...base, order: orderOffset, artists: [], billingRelation: 'SPECIAL_GUEST' }];
    }
    return [
      {
        ...base,
        order: orderOffset,
        artists: [titleCasePreserve(guestBody)],
        billingRelation: 'SPECIAL_GUEST',
      },
    ];
  }

  const relationship = detectRelationshipFromLine(body);
  const expanded = expandLineupLine(body);
  const artists = expanded.map((entry) => entry.displayName).filter(Boolean);
  if (artists.length === 0) {
    return [];
  }

  if (artists.length > 1 && relationship) {
    return [
      {
        ...base,
        order: orderOffset,
        artists,
        billingRelation: toBillingRelation(relationship, expanded[0]),
      },
    ];
  }

  return artists.map((artist, index) => ({
    ...base,
    order: orderOffset + index,
    artists: [artist],
    billingRelation: toBillingRelation(undefined, expanded[index]),
  }));
}

/** Parse multiline/HTML lineup text into grouped canonical entries. */
export function parseLineupTextToCanonicalEntries(
  text: string,
  options?: {
    provenance?: LineupEntryProvenance;
    confidence?: number;
  },
): CanonicalLineupEntry[] {
  const lines = splitLineupTextIntoLines(text);
  const entries: CanonicalLineupEntry[] = [];
  let order = 0;
  for (const line of lines) {
    const parsed = parseLineupLineToCanonicalEntries(line, {
      orderOffset: order,
      provenance: options?.provenance,
      confidence: options?.confidence,
    });
    for (const entry of parsed) {
      entries.push({ ...entry, order });
      order += 1;
    }
  }
  return entries;
}

/** Convert legacy per-artist structured entries into grouped canonical entries. */
export function groupStructuredLineupEntries(
  entries: StructuredLineupEntry[],
): CanonicalLineupEntry[] {
  const sorted = [...entries].sort((left, right) => left.sortOrder - right.sortOrder);
  const result: CanonicalLineupEntry[] = [];
  let order = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!current) {
      continue;
    }
    const name = current.displayName?.trim();
    if (!name || isLineupPlaceholderArtist(name)) {
      continue;
    }

    const relation = current.isB2b
      ? 'B2B'
      : current.isF2f
        ? 'F2F'
        : current.isLiveSet
          ? 'LIVE'
          : current.role?.toLowerCase() === 'support'
            ? 'SUPPORT'
            : current.role?.toLowerCase() === 'hosted_by' || current.role?.toLowerCase() === 'hosted by'
              ? 'HOSTED_BY'
              : 'SOLO';

    const next = sorted[index + 1];
    const canGroup =
      (current.isB2b || current.isF2f) &&
      next &&
      ((current.isB2b && next.isB2b) || (current.isF2f && next.isF2f)) &&
      result.length > 0 &&
      result[result.length - 1]?.billingRelation === relation;

    if (canGroup) {
      const group = result[result.length - 1];
      if (!group) {
        continue;
      }
      group.artists.push(name);
      if (next?.displayName?.trim()) {
        group.artists.push(next.displayName.trim());
        index += 1;
      }
      continue;
    }

    if ((current.isB2b || current.isF2f) && /\b(?:b2b|f2f|vs\.?)\b/i.test(name)) {
      const parsed = parseLineupLineToCanonicalEntries(name, {
        orderOffset: order,
        provenance: { source: current.source },
        confidence: current.confidence,
        stage: current.stageOrFloor,
        startTime: current.startTime,
        endTime: current.endTime,
        runningOrder: current.sortOrder,
      });
      for (const entry of parsed) {
        result.push({ ...entry, order });
        order += 1;
      }
      continue;
    }

    result.push({
      order,
      artists: [name],
      billingRelation: relation,
      stage: current.stageOrFloor,
      startTime: current.startTime,
      endTime: current.endTime,
      runningOrder: current.sortOrder,
      confidence: current.confidence,
      provenance: { source: current.source },
    });
    order += 1;
  }

  return dedupeCanonicalLineupEntries(result);
}

export function soloEntriesFromArtistNames(
  names: string[],
  options?: { provenance?: LineupEntryProvenance; confidence?: number },
): CanonicalLineupEntry[] {
  const entries: CanonicalLineupEntry[] = [];
  let order = 0;
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || isLineupPlaceholderArtist(trimmed)) {
      continue;
    }
    if (/\b(?:b2b|f2f|vs\.?)\b/i.test(trimmed)) {
      const parsed = parseLineupLineToCanonicalEntries(trimmed, {
        orderOffset: order,
        provenance: options?.provenance,
        confidence: options?.confidence,
      });
      for (const entry of parsed) {
        entries.push({ ...entry, order });
        order += 1;
      }
      continue;
    }
    entries.push({
      order,
      artists: [trimmed],
      billingRelation: 'SOLO',
      confidence: options?.confidence,
      provenance: options?.provenance,
    });
    order += 1;
  }
  return dedupeCanonicalLineupEntries(entries);
}

export function dedupeCanonicalLineupEntries(entries: CanonicalLineupEntry[]): CanonicalLineupEntry[] {
  const seen = new Set<string>();
  const result: CanonicalLineupEntry[] = [];
  for (const entry of entries) {
    const key = [
      entry.billingRelation,
      entry.artists.map((name) => normalizeMatchText(name)).join('|'),
      entry.stage ?? '',
      entry.startTime ?? '',
    ].join('::');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ ...entry, order: result.length });
  }
  return result;
}
