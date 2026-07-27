import type { SourceLifecycleStatus } from '@/features/sources/domain/source-registry';

export interface SourceLifecycleInput {
  currentStatus: SourceLifecycleStatus;
  consecutiveFailureCount: number;
  successfulRun: boolean;
  warningCount: number;
}

export interface SourceLifecycleTransition {
  nextStatus: SourceLifecycleStatus;
  automatic: boolean;
  reason: string;
}

export const SOURCE_LIFECYCLE_POLICY = {
  degradedAfterWarnings: 2,
  failingAfterFailures: 3,
  pauseAfterFailures: 5,
} as const;

export class SourceLifecycleResolver {
  resolve(input: SourceLifecycleInput): SourceLifecycleTransition {
    if (input.currentStatus === 'blocked' || input.currentStatus === 'retired') {
      return {
        nextStatus: input.currentStatus,
        automatic: false,
        reason: 'Moderation-controlled lifecycle state.',
      };
    }

    if (input.successfulRun) {
      if (input.currentStatus === 'failing' || input.currentStatus === 'degraded') {
        return {
          nextStatus: 'active',
          automatic: true,
          reason: 'Successful import recovered the source.',
        };
      }
      return {
        nextStatus: input.currentStatus,
        automatic: false,
        reason: 'Successful import confirms current state.',
      };
    }

    if (input.consecutiveFailureCount >= SOURCE_LIFECYCLE_POLICY.pauseAfterFailures) {
      return {
        nextStatus: 'paused',
        automatic: true,
        reason: 'Failure threshold reached; source paused for manual investigation.',
      };
    }
    if (input.consecutiveFailureCount >= SOURCE_LIFECYCLE_POLICY.failingAfterFailures) {
      return {
        nextStatus: 'failing',
        automatic: true,
        reason: 'Repeated import failures.',
      };
    }
    if (input.warningCount >= SOURCE_LIFECYCLE_POLICY.degradedAfterWarnings) {
      return {
        nextStatus: 'degraded',
        automatic: true,
        reason: 'Repeated import warnings.',
      };
    }
    return {
      nextStatus: input.currentStatus,
      automatic: false,
      reason: 'No automatic lifecycle transition is warranted.',
    };
  }
}

export const sourceLifecycleResolver = new SourceLifecycleResolver();
