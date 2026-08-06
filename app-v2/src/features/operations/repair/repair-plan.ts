import { createHash } from 'node:crypto';

import type { RepairPlan, RepairPlanChange, RepairPlanSummary } from './repair-plan.types';

export {
  REPAIR_PLAN_VERSION,
  type RepairPlan,
  type RepairPlanChange,
  type RepairPlanSummary,
  type RepairSafety,
} from './repair-plan.types';

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintRepairRecord(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function summarizeRepairPlanChanges(changes: RepairPlanChange[]): RepairPlanSummary {
  let proposedCount = 0;
  let blockedCount = 0;
  let reviewRequiredCount = 0;

  for (const change of changes) {
    if (change.safety === 'safe_read_only_plan') {
      proposedCount += 1;
    } else if (change.safety === 'review_required') {
      reviewRequiredCount += 1;
    } else {
      blockedCount += 1;
    }
  }

  return {
    proposedCount,
    blockedCount,
    reviewRequiredCount,
    totalChanges: changes.length,
  };
}

export function finalizeRepairPlan(
  draft: Omit<RepairPlan, 'changeChecksum' | 'checksum' | 'summary'> & {
    summary?: RepairPlanSummary;
    changeChecksum?: string;
    checksum?: string;
  },
): RepairPlan {
  const { changeChecksum: _changeChecksum, checksum: _checksum, ...body } = draft;
  const sortedChanges = [...body.changes].sort((left, right) =>
    `${left.entityType}:${left.entityId}:${left.fieldOrRelationship}`.localeCompare(
      `${right.entityType}:${right.entityId}:${right.fieldOrRelationship}`,
    ),
  );
  const summary = body.summary ?? summarizeRepairPlanChanges(sortedChanges);
  const deterministic = {
    ...body,
    generatedAt: undefined,
    planId: undefined,
    summary: undefined,
    changes: sortedChanges,
  };
  const changeChecksum = fingerprintRepairRecord(deterministic.changes);
  const checksum = fingerprintRepairRecord({ ...deterministic, changeChecksum });
  return { ...body, changes: sortedChanges, summary, changeChecksum, checksum };
}

export function validateRepairPlanChecksum(plan: RepairPlan): boolean {
  const { changeChecksum, checksum, ...draft } = plan;
  const recalculated = finalizeRepairPlan(draft);
  return changeChecksum === recalculated.changeChecksum && checksum === recalculated.checksum;
}
