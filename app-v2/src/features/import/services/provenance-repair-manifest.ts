import { createHash } from 'node:crypto';

export interface ProvenanceRollbackSnapshot {
  id: string;
  selectedValue: unknown;
  selectedSourceId: string | null;
  manuallyOverridden: boolean;
  alternatives: unknown[];
  updatedAt: string;
  selectedAt: string;
  selectionReason: string;
  confidence: number | null;
  freshnessAt: string | null;
  originExternalId: string | null;
  mergeDecision: string | null;
  selectedTier: string | null;
}

export interface ProvenanceRepairCorrectionEntry {
  fieldPath: string;
  provenanceId: string;
  rollbackSnapshot: Record<string, unknown>;
  correctedFreshnessAt: string;
}

export type ProvenanceRepairKind =
  | 'exact_snapshot_restore'
  | 'live_source_reverification'
  | 'freshness_only_known_evidence'
  | 'review_only';

export const REPAIR_APPLY_SELECTED_AT_SENTINEL = 'pending:repair_apply_selected_at';

export interface ProvenancePlanEntry {
  group: 'A' | 'B' | 'C';
  fieldPath: string;
  provenanceId: string;
  repairKind: ProvenanceRepairKind;
  rollbackSnapshot: ProvenanceRollbackSnapshot;
  afterSnapshot: ProvenanceRollbackSnapshot;
  evidenceUrl: string | null;
  evidenceVerifiedAt: string | null;
  repairReason: string;
  rowFingerprint: string;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export function buildProvenanceRowFingerprint(row: Record<string, unknown>): string {
  const payload = {
    id: row.id,
    canonical_event_id: row.canonical_event_id,
    field_path: row.field_path,
    selected_value: row.selected_value,
    selected_source_id: row.selected_source_id,
    selected_at: row.selected_at,
    selection_reason: row.selection_reason,
    alternatives: row.alternatives,
    manually_overridden: row.manually_overridden,
    updated_at: row.updated_at,
    confidence: row.confidence,
    freshness_at: row.freshness_at,
    origin_external_id: row.origin_external_id,
    merge_decision: row.merge_decision,
    selected_tier: row.selected_tier,
  };
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

export function fingerprintFromSnapshot(
  provenanceId: string,
  canonicalEventId: string,
  fieldPath: string,
  snapshot: ProvenanceRollbackSnapshot,
): string {
  return buildProvenanceRowFingerprint({
    id: provenanceId,
    canonical_event_id: canonicalEventId,
    field_path: fieldPath,
    selected_value: snapshot.selectedValue,
    selected_source_id: snapshot.selectedSourceId,
    selected_at: snapshot.selectedAt,
    selection_reason: snapshot.selectionReason,
    alternatives: snapshot.alternatives,
    manually_overridden: snapshot.manuallyOverridden,
    updated_at: snapshot.updatedAt,
    confidence: snapshot.confidence,
    freshness_at: snapshot.freshnessAt,
    origin_external_id: snapshot.originExternalId,
    merge_decision: snapshot.mergeDecision,
    selected_tier: snapshot.selectedTier,
  });
}

export function isExactStoredBeforeSnapshot(input: {
  snapshot: ProvenanceRollbackSnapshot;
  artifactPhase: string;
  artifactFieldPath: string;
}): boolean {
  return Boolean(input.artifactPhase && input.artifactFieldPath);
}

export function rejectApproximatedBeforeRestore(reason: string): void {
  throw new Error(`approximated_before_restore_rejected:${reason}`);
}

export function assertRepairKindAllowed(
  repairKind: ProvenanceRepairKind,
  context: {
    hasExactStoredSnapshot?: boolean;
    hasKnownEvidenceVerifiedAt?: boolean;
    liveReverificationConfirmed?: boolean;
  },
): void {
  switch (repairKind) {
    case 'exact_snapshot_restore':
      if (!context.hasExactStoredSnapshot) {
        rejectApproximatedBeforeRestore('missing_stored_before_snapshot');
      }
      return;
    case 'freshness_only_known_evidence':
      if (!context.hasKnownEvidenceVerifiedAt) {
        throw new Error('freshness_correction_requires_known_evidence_verified_at');
      }
      return;
    case 'live_source_reverification':
      if (!context.liveReverificationConfirmed) {
        throw new Error('live_reverification_requires_confirmed_native_evidence');
      }
      return;
    case 'review_only':
      return;
    default:
      throw new Error(`unsupported_repair_kind:${repairKind}`);
  }
}

export function deduplicateAlternatives(
  alternatives: readonly unknown[],
  incoming?: Record<string, unknown>,
): unknown[] {
  const normalized = [...alternatives];
  if (!incoming?.sourceId) {
    return normalized;
  }
  const without = normalized.filter(
    (entry) =>
      !(typeof entry === 'object'
        && entry !== null
        && String((entry as Record<string, unknown>).sourceId) === String(incoming.sourceId)),
  );
  return [...without, incoming];
}

export function buildStableProvenanceRepairManifestHash(input: {
  phase: string;
  canonicalEventId: string;
  evidenceVerifiedAt: string;
  corrections: ProvenanceRepairCorrectionEntry[];
}): string {
  const payload = {
    phase: input.phase,
    canonicalEventId: input.canonicalEventId,
    evidenceVerifiedAt: input.evidenceVerifiedAt,
    corrections: input.corrections
      .map((entry) => ({
        fieldPath: entry.fieldPath,
        provenanceId: entry.provenanceId,
        rollbackSnapshot: entry.rollbackSnapshot,
        correctedFreshnessAt: entry.correctedFreshnessAt,
      }))
      .sort((left, right) => left.fieldPath.localeCompare(right.fieldPath)),
  };
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

export function buildStableProvenancePlanManifestHash(input: {
  phase: string;
  canonicalEventId: string;
  ticketEvidenceVerifiedAt: string;
  entries: ProvenancePlanEntry[];
}): string {
  const payload = {
    phase: input.phase,
    canonicalEventId: input.canonicalEventId,
    ticketEvidenceVerifiedAt: input.ticketEvidenceVerifiedAt,
    entries: input.entries
      .map((entry) => ({
        group: entry.group,
        fieldPath: entry.fieldPath,
        provenanceId: entry.provenanceId,
        repairKind: entry.repairKind,
        rollbackSnapshot: entry.rollbackSnapshot,
        afterSnapshot: sanitizeAfterSnapshotForHash(entry.afterSnapshot),
        evidenceUrl: entry.evidenceUrl,
        evidenceVerifiedAt: entry.evidenceVerifiedAt,
        repairReason: entry.repairReason,
        rowFingerprint: entry.rowFingerprint,
      }))
      .sort((left, right) => left.fieldPath.localeCompare(right.fieldPath)),
  };
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

function sanitizeAfterSnapshotForHash(snapshot: ProvenanceRollbackSnapshot): ProvenanceRollbackSnapshot {
  if (snapshot.selectedAt === REPAIR_APPLY_SELECTED_AT_SENTINEL) {
    return { ...snapshot, selectedAt: REPAIR_APPLY_SELECTED_AT_SENTINEL };
  }
  return snapshot;
}
