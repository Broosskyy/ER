import type { BillingRelation } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';

/** Consumer/API projection of a structured lineup entry (no entity IDs required). */
export interface EventLineupEntryProjection {
  order: number;
  artists: string[];
  billingRelation: BillingRelation;
  stage?: string;
  startTime?: string;
  endTime?: string;
  runningOrder?: number;
  confidence?: number;
  provenance?: ResolvedCanonicalLineupEntry['provenance'];
}

export function mapResolvedEntryToProjection(
  entry: ResolvedCanonicalLineupEntry,
): EventLineupEntryProjection {
  return {
    order: entry.order,
    artists: [...entry.artists],
    billingRelation: entry.billingRelation,
    stage: entry.stage,
    startTime: entry.startTime,
    endTime: entry.endTime,
    runningOrder: entry.runningOrder,
    confidence: entry.confidence,
    provenance: entry.provenance,
  };
}

export function mapResolvedEntriesToProjections(
  entries: ResolvedCanonicalLineupEntry[],
): EventLineupEntryProjection[] {
  return [...entries]
    .sort((left, right) => left.order - right.order)
    .map((entry) => mapResolvedEntryToProjection(entry));
}
