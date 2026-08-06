import type {
  BillingRelation,
  CanonicalLineupEntry,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

export interface LineupEntryMergeCandidate {
  entries: CanonicalLineupEntry[];
  confidence: number;
  sourceId?: string;
  sourceType?: string;
}

function entrySignature(entry: CanonicalLineupEntry): string {
  return [
    entry.billingRelation,
    entry.artists.map((name) => normalizeMatchText(name)).join('|'),
    entry.stage ?? '',
    entry.startTime ?? '',
    entry.endTime ?? '',
  ].join('::');
}

function billingRelationScore(relation: BillingRelation): number {
  switch (relation) {
    case 'SOLO':
      return 0;
    case 'B2B':
    case 'F2F':
    case 'VS':
      return 3;
    case 'LIVE':
    case 'SUPPORT':
    case 'HOSTED_BY':
    case 'SPECIAL_GUEST':
      return 2;
    default:
      return 0;
  }
}

function mergeEntryPair(
  existing: CanonicalLineupEntry,
  incoming: CanonicalLineupEntry,
  incomingConfidence: number,
  existingConfidence: number,
): CanonicalLineupEntry {
  const existingScore = billingRelationScore(existing.billingRelation) + existingConfidence;
  const incomingScore = billingRelationScore(incoming.billingRelation) + incomingConfidence;

  const preferIncoming = incomingScore > existingScore;
  const base = preferIncoming ? incoming : existing;
  const fallback = preferIncoming ? existing : incoming;

  return {
    order: base.order,
    artists: base.artists.length > 0 ? base.artists : fallback.artists,
    billingRelation:
      billingRelationScore(base.billingRelation) >= billingRelationScore(fallback.billingRelation)
        ? base.billingRelation
        : fallback.billingRelation,
    stage: base.stage ?? fallback.stage,
    startTime: base.startTime ?? fallback.startTime,
    endTime: base.endTime ?? fallback.endTime,
    runningOrder: base.runningOrder ?? fallback.runningOrder,
    confidence: Math.max(existingConfidence, incomingConfidence),
    provenance: base.provenance ?? fallback.provenance,
  };
}

/** Source-agnostic structured lineup merge — never downgrade billing semantics. */
export function mergeCanonicalLineupEntries(
  existing: CanonicalLineupEntry[],
  incoming: CanonicalLineupEntry[],
  options?: {
    existingConfidence?: number;
    incomingConfidence?: number;
  },
): CanonicalLineupEntry[] {
  const existingConfidence = options?.existingConfidence ?? 0.5;
  const incomingConfidence = options?.incomingConfidence ?? 0.75;

  if (incoming.length === 0) {
    return existing;
  }
  if (existing.length === 0) {
    return incoming.map((entry, index) => ({ ...entry, order: index }));
  }

  const incomingBySignature = new Map(
    incoming.map((entry) => [entrySignature(entry), entry] as const),
  );
  const merged: CanonicalLineupEntry[] = [];
  const consumed = new Set<string>();

  for (const entry of existing) {
    const signature = entrySignature(entry);
    const match = incomingBySignature.get(signature);
    if (match) {
      merged.push(mergeEntryPair(entry, match, incomingConfidence, existingConfidence));
      consumed.add(signature);
      continue;
    }
    merged.push(entry);
  }

  for (const entry of incoming) {
    const signature = entrySignature(entry);
    if (consumed.has(signature)) {
      continue;
    }
    merged.push(entry);
  }

  return merged
    .sort((left, right) => left.order - right.order)
    .map((entry, index) => ({ ...entry, order: index }));
}

export function pickBetterLineupEntryCandidates(
  candidates: LineupEntryMergeCandidate[],
): CanonicalLineupEntry[] {
  if (candidates.length === 0) {
    return [];
  }

  const sorted = [...candidates].sort((left, right) => {
    if (right.entries.length !== left.entries.length) {
      return right.entries.length - left.entries.length;
    }
    return right.confidence - left.confidence;
  });

  let merged = sorted[0]?.entries ?? [];
  for (let index = 1; index < sorted.length; index += 1) {
    const candidate = sorted[index];
    if (!candidate) {
      continue;
    }
    merged = mergeCanonicalLineupEntries(merged, candidate.entries, {
      existingConfidence: sorted[0]?.confidence ?? 0.5,
      incomingConfidence: candidate.confidence,
    });
  }

  return merged;
}
