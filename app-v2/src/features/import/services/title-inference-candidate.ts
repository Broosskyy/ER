import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import type { CanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { filterArtistCandidatesThroughGate } from '@/features/events/domain/artist-candidate-quality-gate';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import type { LineupCompleteness } from '@/features/import/services/import-title-lineup-resolver';

const TITLE_INFERENCE_CONFIDENCE = 0.35;

export function hasHigherTrustLineupEvidence(record: ImportRecord): boolean {
  const structured = extractPrioritizedLineupEntries(record);
  if (structured.entries.length > 0) {
    return true;
  }

  const prioritized = extractPrioritizedArtistNames(record);
  if (prioritized.names.length > 0 && prioritized.source !== 'title_inference') {
    return true;
  }

  return false;
}

/**
 * Title inference is disabled for publish — proven root cause H_TITLE_INFERENCE_PROMOTED.
 * Candidates remain available for audit/diagnostics via buildTitleInferenceCandidates when explicitly enabled.
 */
export function canRunTitleInference(_record: ImportRecord): boolean {
  return false;
}

/**
 * Build low-trust SOLO structured candidates from event title.
 * Never marks lineup complete; emits explicit title-inference provenance.
 */
export function buildTitleInferenceCandidates(record: ImportRecord): {
  entries: CanonicalLineupEntry[];
  completeness: LineupCompleteness;
} {
  if (!canRunTitleInference(record)) {
    return { entries: [], completeness: 'none' };
  }

  const candidate = getEffectiveCandidate(record);
  const titleArtists = extractArtistsFromEventTitle(candidate.title ?? '') ?? [];
  const gated = filterArtistCandidatesThroughGate(titleArtists, {
    sourceField: 'title',
    extractionStrategy: 'title_inference',
    eventTitle: candidate.title,
  });

  if (gated.length === 0) {
    return { entries: [], completeness: 'none' };
  }

  const provenance = {
    source: 'title_inferred_only',
    importRecordId: record.id,
    connector: 'title_inference',
    sourceUrl: candidate.sourceUrl ?? candidate.eventUrl,
  };

  const entries: CanonicalLineupEntry[] = gated.map((name, order) => ({
    order,
    artists: [name],
    billingRelation: 'SOLO',
    confidence: TITLE_INFERENCE_CONFIDENCE,
    provenance,
  }));

  return {
    entries,
    completeness: gated.length === 1 ? 'partial' : 'partial',
  };
}
