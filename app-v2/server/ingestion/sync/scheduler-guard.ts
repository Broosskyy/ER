import {
  PRODUCTION_SCHEDULER_ENABLED,
  STAGING_SCHEDULER_ENABLED,
  isStagingScheduledConnectorId,
} from './scheduler-boundary';
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  assertNotProductionRef,
  assertStagingTarget,
  type VerifiedStagingTarget,
} from './staging-guard';
import type { IngestionErrorCategory, SyncRunMode, SyncTriggerType } from './types';

export interface ScheduledApplyGuardInput {
  connectorId: string;
  mode: SyncRunMode;
  triggerType: SyncTriggerType;
  linkedProjectRef?: string;
}

export interface ScheduledApplyGuardResult {
  allowed: boolean;
  errorCategory?: IngestionErrorCategory;
  errorSummary?: string;
}

export function evaluateScheduledApplyGuard(
  input: ScheduledApplyGuardInput,
  options?: { stagingSchedulerEnabled?: boolean },
): ScheduledApplyGuardResult {
  if (input.triggerType !== 'scheduled') {
    return { allowed: true };
  }

  if (input.mode !== 'apply') {
    return { allowed: true };
  }

  const stagingSchedulerEnabled = options?.stagingSchedulerEnabled ?? STAGING_SCHEDULER_ENABLED;

  if (PRODUCTION_SCHEDULER_ENABLED) {
    return {
      allowed: false,
      errorCategory: 'production_scheduler_forbidden',
      errorSummary: 'production_scheduler_forbidden',
    };
  }

  if (!stagingSchedulerEnabled) {
    return {
      allowed: false,
      errorCategory: 'scheduler_disabled',
      errorSummary: 'scheduler_disabled',
    };
  }

  if (input.linkedProjectRef) {
    if (input.linkedProjectRef === PRODUCTION_PROJECT_REF) {
      return {
        allowed: false,
        errorCategory: 'production_scheduler_forbidden',
        errorSummary: 'production_scheduler_apply_rejected',
      };
    }
    if (input.linkedProjectRef !== STAGING_PROJECT_REF) {
      return {
        allowed: false,
        errorCategory: 'apply_precondition_failed',
        errorSummary: `staging_target_mismatch:${input.linkedProjectRef}`,
      };
    }
  }

  if (!isStagingScheduledConnectorId(input.connectorId)) {
    return {
      allowed: false,
      errorCategory: 'apply_precondition_failed',
      errorSummary: `connector_not_scheduled:${input.connectorId}`,
    };
  }

  return { allowed: true };
}

export function assertScheduledStagingApplyAllowed(input: ScheduledApplyGuardInput): void {
  const result = evaluateScheduledApplyGuard(input);
  if (!result.allowed) {
    throw new Error(result.errorSummary ?? 'scheduled_apply_forbidden');
  }
}

export function rejectProductionProjectRef(ref: string, name = 'unknown'): void {
  assertNotProductionRef(ref, name);
}

export function assertStagingProjectRef(ref: string, name: string): VerifiedStagingTarget {
  return assertStagingTarget(ref, name);
}

export function productionSchedulerApplyWouldBeRejected(linkedProjectRef: string): boolean {
  return (
    linkedProjectRef === PRODUCTION_PROJECT_REF ||
    evaluateScheduledApplyGuard({
      connectorId: 'bootshaus-official',
      mode: 'apply',
      triggerType: 'scheduled',
      linkedProjectRef,
    }).errorCategory === 'production_scheduler_forbidden'
  );
}
