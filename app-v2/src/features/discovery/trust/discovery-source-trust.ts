import type { SourceRecord } from '@/data/types/records';
import type { Event } from '@/features/events/types/event';
import { sourceTrustEngine } from '@/features/trust-quality/services/source-trust-engine';

/** Neutral fallback when a source record is missing. */
export const DISCOVERY_DEFAULT_SOURCE_TRUST = 50;

/**
 * Multi-source trust aggregation:
 * 1. Collect all known source IDs for the event (primary `event.source` plus optional contributors).
 * 2. Use the highest effective trust score among them (optimistic, deterministic).
 * 3. Fall back to DISCOVERY_DEFAULT_SOURCE_TRUST when no source trust is known.
 */
export function aggregateDiscoverySourceTrust(
  sourceTrustScores: number[],
  fallback = DISCOVERY_DEFAULT_SOURCE_TRUST,
): number {
  if (sourceTrustScores.length === 0) {
    return fallback;
  }
  return Math.max(...sourceTrustScores);
}

export function resolveEffectiveSourceTrust(source: SourceRecord): number {
  return sourceTrustEngine.getEffectiveTrust(source).trustScore;
}

export function buildDiscoverySourceTrustIndex(sources: SourceRecord[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const source of sources) {
    index.set(source.id, resolveEffectiveSourceTrust(source));
  }
  return index;
}

export function collectEventSourceIds(
  event: Event,
  contributorSourceIds: string[] = [],
): string[] {
  const ids = new Set<string>();
  if (event.source && event.source !== 'supabase') {
    ids.add(event.source);
  }
  for (const sourceId of contributorSourceIds) {
    if (sourceId) {
      ids.add(sourceId);
    }
  }
  return [...ids];
}

export function resolveEventDiscoveryTrust(input: {
  event: Event;
  trustBySourceId: Map<string, number>;
  contributorSourceIds?: string[];
  fallback?: number;
}): number {
  const sourceIds = collectEventSourceIds(input.event, input.contributorSourceIds);
  const scores = sourceIds
    .map((sourceId) => input.trustBySourceId.get(sourceId))
    .filter((score): score is number => score !== undefined);

  return aggregateDiscoverySourceTrust(scores, input.fallback ?? DISCOVERY_DEFAULT_SOURCE_TRUST);
}

export interface DiscoverySourceTrustProvider {
  getTrustIndexForEvents(events: Event[]): Map<string, number> | Promise<Map<string, number>>;
}

export function createStaticDiscoverySourceTrustProvider(
  trustBySourceId: Map<string, number>,
): DiscoverySourceTrustProvider {
  return {
    getTrustIndexForEvents() {
      return trustBySourceId;
    },
  };
}

export function createDiscoverySourceTrustProvider(
  loadSourcesByIds: (sourceIds: string[]) => Promise<SourceRecord[]>,
): DiscoverySourceTrustProvider {
  let cachedIndex: Map<string, number> | null = null;
  let cachedSourceIdsKey = '';

  return {
    async getTrustIndexForEvents(events: Event[]) {
      const sourceIds = [...new Set(events.flatMap((event) => collectEventSourceIds(event)))].sort();
      const cacheKey = sourceIds.join('|');
      if (cachedIndex && cacheKey === cachedSourceIdsKey) {
        return cachedIndex;
      }
      const sources = sourceIds.length > 0 ? await loadSourcesByIds(sourceIds) : [];
      cachedIndex = buildDiscoverySourceTrustIndex(sources);
      cachedSourceIdsKey = cacheKey;
      return cachedIndex;
    },
  };
}
