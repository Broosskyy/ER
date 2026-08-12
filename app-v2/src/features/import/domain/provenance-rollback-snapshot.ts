import { createHash } from 'node:crypto';

import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import { compareCanonicalTicketPhasesSemantically } from '@/features/events/domain/ticket-field-readback-comparison';

export type ProvenanceBeforeState = 'existing' | 'absent';

export type ProvenanceRollbackActionKind =
  | 'restore_exact_snapshot'
  | 'delete_exact_insert'
  | 'abort_due_to_drift';

export interface ProvenanceRollbackRowSnapshot {
  id: string;
  canonicalEventId: string;
  fieldPath: string;
  selectedValue: unknown;
  selectedSourceId: string | null;
  selectedAt: string | null;
  selectionReason: string | null;
  alternatives: unknown;
  manuallyOverridden: boolean | null;
  updatedAt: string | null;
  freshnessAt: string | null;
  confidence?: number | null;
  originExternalId?: string | null;
  mergeDecision?: string | null;
  selectedTier?: string | null;
}

export interface ProvenanceAttemptMetadata {
  selectionReason: string;
  freshnessAt: string;
  selectedSourceId: string;
}

export interface ProvenanceFieldRollbackPlan {
  fieldPath: string;
  beforeState: ProvenanceBeforeState;
  beforeSnapshot?: ProvenanceRollbackRowSnapshot;
  expectedInsertFingerprint?: string;
  attempt: ProvenanceAttemptMetadata;
  rollbackAction: ProvenanceRollbackActionKind;
}

export interface ProvenanceRollbackResolution {
  fieldPath: string;
  action: ProvenanceRollbackActionKind;
  provenanceId?: string;
  restoreSnapshot?: ProvenanceRollbackRowSnapshot;
  driftReason?: string;
}

export interface ProvenanceRollbackPlanResult {
  resolutions: ProvenanceRollbackResolution[];
  restoreCount: number;
  deleteCount: number;
  abortCount: number;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function stableSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortKeys);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = stableSortKeys(record[key]);
    }
    return sorted;
  }
  return value;
}

function normalizeProvenanceSelectedValue(fieldPath: string, value: unknown): unknown {
  if (fieldPath === 'ticketPhases' && Array.isArray(value)) {
    const phases = value as CanonicalTicketPhase[];
    const canonical = phases;
    const roundtrip = JSON.parse(stableJson(phases)) as CanonicalTicketPhase[];
    if (compareCanonicalTicketPhasesSemantically(canonical, roundtrip).equal) {
      return stableSortKeys(roundtrip);
    }
  }
  return stableSortKeys(value);
}

export function mapDbProvenanceRow(row: Record<string, unknown>): ProvenanceRollbackRowSnapshot {
  return {
    id: String(row.id),
    canonicalEventId: String(row.canonical_event_id),
    fieldPath: String(row.field_path),
    selectedValue: row.selected_value,
    selectedSourceId: (row.selected_source_id as string | null) ?? null,
    selectedAt: (row.selected_at as string | null) ?? null,
    selectionReason: (row.selection_reason as string | null) ?? null,
    alternatives: row.alternatives ?? [],
    manuallyOverridden: (row.manually_overridden as boolean | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    freshnessAt: (row.freshness_at as string | null) ?? null,
    confidence: (row.confidence as number | null) ?? null,
    originExternalId: (row.origin_external_id as string | null) ?? null,
    mergeDecision: (row.merge_decision as string | null) ?? null,
    selectedTier: (row.selected_tier as string | null) ?? null,
  };
}

function normalizeTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

export function provenanceRowFingerprint(row: ProvenanceRollbackRowSnapshot): string {
  const payload = {
    id: row.id,
    canonical_event_id: row.canonicalEventId,
    field_path: row.fieldPath,
    selected_value: normalizeProvenanceSelectedValue(row.fieldPath, row.selectedValue),
    selected_source_id: row.selectedSourceId,
    selection_reason: row.selectionReason,
    freshness_at: normalizeTimestamp(row.freshnessAt),
  };
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

export function buildExpectedInsertFingerprint(input: {
  eventId: string;
  fieldPath: string;
  selectedValue: unknown;
  attempt: ProvenanceAttemptMetadata;
}): string {
  return provenanceRowFingerprint({
    id: `provenance-${input.eventId}-${input.fieldPath}`,
    canonicalEventId: input.eventId,
    fieldPath: input.fieldPath,
    selectedValue: input.selectedValue,
    selectedSourceId: input.attempt.selectedSourceId,
    selectedAt: input.attempt.freshnessAt,
    selectionReason: input.attempt.selectionReason,
    alternatives: [],
    manuallyOverridden: false,
    updatedAt: input.attempt.freshnessAt,
    freshnessAt: input.attempt.freshnessAt,
  });
}

export function captureProvenanceFieldRollbackPlans(input: {
  eventId: string;
  fieldPaths: string[];
  beforeRows: ProvenanceRollbackRowSnapshot[];
  attempt: ProvenanceAttemptMetadata;
  plannedInsertValues: Record<string, unknown>;
}): ProvenanceFieldRollbackPlan[] {
  return input.fieldPaths.map((fieldPath) => {
    const beforeSnapshot = input.beforeRows.find((row) => row.fieldPath === fieldPath);
    if (beforeSnapshot) {
      return {
        fieldPath,
        beforeState: 'existing',
        beforeSnapshot,
        attempt: input.attempt,
        rollbackAction: 'restore_exact_snapshot',
      };
    }
    return {
      fieldPath,
      beforeState: 'absent',
      expectedInsertFingerprint: buildExpectedInsertFingerprint({
        eventId: input.eventId,
        fieldPath,
        selectedValue: input.plannedInsertValues[fieldPath],
        attempt: input.attempt,
      }),
      attempt: input.attempt,
      rollbackAction: 'delete_exact_insert',
    };
  });
}

function rowsSemanticallyEqual(
  left: ProvenanceRollbackRowSnapshot,
  right: ProvenanceRollbackRowSnapshot,
): boolean {
  const valuesEqual =
    left.fieldPath === 'ticketPhases' && Array.isArray(left.selectedValue) && Array.isArray(right.selectedValue)
      ? compareCanonicalTicketPhasesSemantically(
          left.selectedValue as CanonicalTicketPhase[],
          right.selectedValue as CanonicalTicketPhase[],
        ).equal
      : stableJson(normalizeProvenanceSelectedValue(left.fieldPath, left.selectedValue)) ===
        stableJson(normalizeProvenanceSelectedValue(right.fieldPath, right.selectedValue));

  return (
    left.id === right.id &&
    left.canonicalEventId === right.canonicalEventId &&
    left.fieldPath === right.fieldPath &&
    valuesEqual &&
    left.selectedSourceId === right.selectedSourceId &&
    left.selectionReason === right.selectionReason &&
    new Date(String(left.freshnessAt)).toISOString() ===
      new Date(String(right.freshnessAt)).toISOString() &&
    left.manuallyOverridden === right.manuallyOverridden
  );
}

export function resolveProvenanceRollbackActions(input: {
  plans: ProvenanceFieldRollbackPlan[];
  currentRows: ProvenanceRollbackRowSnapshot[];
}): ProvenanceRollbackPlanResult {
  const resolutions: ProvenanceRollbackResolution[] = [];
  let restoreCount = 0;
  let deleteCount = 0;
  let abortCount = 0;

  for (const plan of input.plans) {
    const current = input.currentRows.find((row) => row.fieldPath === plan.fieldPath);
    if (plan.beforeState === 'existing') {
      if (!plan.beforeSnapshot) {
        resolutions.push({
          fieldPath: plan.fieldPath,
          action: 'abort_due_to_drift',
          driftReason: 'missing_before_snapshot',
        });
        abortCount += 1;
        continue;
      }
      if (current?.manuallyOverridden) {
        resolutions.push({
          fieldPath: plan.fieldPath,
          action: 'abort_due_to_drift',
          provenanceId: current.id,
          driftReason: 'manual_lock_present',
        });
        abortCount += 1;
        continue;
      }
      if (current && current.id !== plan.beforeSnapshot.id) {
        resolutions.push({
          fieldPath: plan.fieldPath,
          action: 'abort_due_to_drift',
          provenanceId: current.id,
          driftReason: 'foreign_provenance_id',
        });
        abortCount += 1;
        continue;
      }
      if (
        current &&
        current.selectionReason === plan.attempt.selectionReason &&
        new Date(String(current.freshnessAt)).toISOString() ===
          new Date(plan.attempt.freshnessAt).toISOString() &&
        !rowsSemanticallyEqual(current, plan.beforeSnapshot)
      ) {
        resolutions.push({
          fieldPath: plan.fieldPath,
          action: 'restore_exact_snapshot',
          provenanceId: plan.beforeSnapshot.id,
          restoreSnapshot: plan.beforeSnapshot,
        });
        restoreCount += 1;
        continue;
      }
      if (current && rowsSemanticallyEqual(current, plan.beforeSnapshot)) {
        resolutions.push({
          fieldPath: plan.fieldPath,
          action: 'restore_exact_snapshot',
          provenanceId: plan.beforeSnapshot.id,
          restoreSnapshot: plan.beforeSnapshot,
        });
        restoreCount += 1;
        continue;
      }
      resolutions.push({
        fieldPath: plan.fieldPath,
        action: 'restore_exact_snapshot',
        provenanceId: plan.beforeSnapshot.id,
        restoreSnapshot: plan.beforeSnapshot,
      });
      restoreCount += 1;
      continue;
    }

    if (!current) {
      resolutions.push({
        fieldPath: plan.fieldPath,
        action: 'delete_exact_insert',
      });
      deleteCount += 1;
      continue;
    }

    const fingerprint = provenanceRowFingerprint(current);
    const belongsToAttempt =
      current.selectionReason === plan.attempt.selectionReason &&
      new Date(String(current.freshnessAt)).toISOString() ===
        new Date(plan.attempt.freshnessAt).toISOString();

    if (
      belongsToAttempt &&
      plan.expectedInsertFingerprint &&
      fingerprint === plan.expectedInsertFingerprint
    ) {
      resolutions.push({
        fieldPath: plan.fieldPath,
        action: 'delete_exact_insert',
        provenanceId: current.id,
      });
      deleteCount += 1;
      continue;
    }

    resolutions.push({
      fieldPath: plan.fieldPath,
      action: 'abort_due_to_drift',
      provenanceId: current.id,
      driftReason: belongsToAttempt
        ? 'insert_fingerprint_mismatch'
        : 'foreign_or_updated_provenance_row',
    });
    abortCount += 1;
  }

  return {
    resolutions,
    restoreCount,
    deleteCount,
    abortCount,
  };
}
