import { createHash } from 'node:crypto';

export interface ApplyWriteCounters {
  attemptedWrites: number;
  successfulWrites: number;
  rollbackWrites: number;
  retryWrites: number;
  finalCommittedFieldMutations: number;
  finalLineupOperations: number;
  totalProductionWriteOperations: number;
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Hash only immutable apply payload — excludes generatedAt and self-hash fields. */
export function computeImmutableManifestBody(plan: Record<string, unknown>): Record<string, unknown> {
  const events = Array.isArray(plan.events) ? plan.events : [];
  return {
    phase: plan.phase,
    parentManifestHash: plan.parentManifestHash,
    sourceManifestHash: plan.sourceManifestHash,
    applyToken: plan.applyToken,
    consumerPreviewNow: plan.consumerPreviewNow,
    events: events.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        key: e.key,
        eventId: e.eventId,
        restrictedPatch: e.restrictedPatch,
        lineupArtistNames: e.lineupArtistNames,
        rowFingerprintAtPlanTime: e.rowFingerprintAtPlanTime,
        lineupApply: e.lineupApply,
        fieldPlans: e.fieldPlans,
        intentionallyOmitted: e.intentionallyOmitted,
      };
    }),
  };
}

export function computeStableManifestHash(plan: Record<string, unknown>): string {
  return stableHash(computeImmutableManifestBody(plan));
}

export function verifyApprovedManifestHash(
  plan: Record<string, unknown>,
  expectedHash: string,
): { ok: boolean; computedHash: string; expectedHash: string } {
  const computedHash = computeStableManifestHash(plan);
  return { ok: computedHash === expectedHash, computedHash, expectedHash };
}

export function createApplyWriteCounters(): ApplyWriteCounters {
  return {
    attemptedWrites: 0,
    successfulWrites: 0,
    rollbackWrites: 0,
    retryWrites: 0,
    finalCommittedFieldMutations: 0,
    finalLineupOperations: 0,
    totalProductionWriteOperations: 0,
  };
}

export function recordAttemptedWrite(counters: ApplyWriteCounters, isRetry = false): void {
  counters.attemptedWrites += 1;
  if (isRetry) {
    counters.retryWrites += 1;
  }
}

export function recordSuccessfulWrite(
  counters: ApplyWriteCounters,
  fieldMutations = 0,
  lineupOperations = 0,
): void {
  counters.successfulWrites += 1;
  counters.finalCommittedFieldMutations += fieldMutations;
  counters.finalLineupOperations += lineupOperations;
  counters.totalProductionWriteOperations += fieldMutations + lineupOperations;
}

export function recordRollbackWrite(counters: ApplyWriteCounters, rolledBackOps = 0): void {
  counters.rollbackWrites += 1;
  counters.totalProductionWriteOperations += rolledBackOps;
}

export function productionMutationsInThisRun(counters: ApplyWriteCounters): number {
  return counters.totalProductionWriteOperations;
}
