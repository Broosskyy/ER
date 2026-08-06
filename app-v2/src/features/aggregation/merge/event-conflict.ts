import type { SourcePriorityTier } from '@/features/events/domain/field-ownership-policy';

export const EVENT_CONFLICT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type EventConflictSeverity = (typeof EVENT_CONFLICT_SEVERITIES)[number];

export interface EventConflict {
  id: string;
  canonicalEventId: string;
  field: string;
  values: Array<{ sourceId: string; value: unknown }>;
  sourceIds: string[];
  severity: EventConflictSeverity;
  detectedAt: string;
  resolved: boolean;
  resolution?: string;
  resolvedAt?: string;
}

export interface FieldProvenanceAlternative<T = unknown> {
  sourceId: string;
  value: T;
  confidence?: number;
  freshnessAt?: string;
  originExternalId?: string;
  mergeDecision?: string;
}

export interface FieldProvenance<T = unknown> {
  value: T;
  selectedSourceId: string;
  selectionReason: string;
  alternatives: Array<FieldProvenanceAlternative<T>>;
  lastChangedAt: string;
  confidence?: number;
  freshnessAt?: string;
  originExternalId?: string;
  mergeDecision?: string;
  selectedTier?: SourcePriorityTier;
}

export interface DuplicateDecision {
  id: string;
  candidateIds: string[];
  canonicalEventId?: string;
  decision:
    | 'merged'
    | 'kept_separate'
    | 'deferred'
    | 'related_series'
    | 'false_positive'
    | 'false_negative_correction';
  reason: string;
  decidedAt: string;
  decidedBy?: string;
  confidence: number;
  sourceIds: string[];
  fingerprintSnapshot: Record<string, string>;
  reversible: boolean;
  reversedAt?: string;
}

export function detectConflictingValues(
  canonicalEventId: string,
  field: string,
  values: Array<{ sourceId: string; value: unknown }>,
  severity: EventConflictSeverity,
  detectedAt = new Date().toISOString(),
): EventConflict | null {
  const distinctValues = new Set(values.map((entry) => JSON.stringify(entry.value)));
  if (distinctValues.size < 2) {
    return null;
  }
  return {
    id: `conflict-${canonicalEventId}-${field}-${Date.parse(detectedAt)}`,
    canonicalEventId,
    field,
    values,
    sourceIds: [...new Set(values.map((entry) => entry.sourceId))],
    severity,
    detectedAt,
    resolved: false,
  };
}
