import type { SourceOnboardingStatus } from '@/features/source-onboarding/domain/types';

const ALLOWED_TRANSITIONS: Record<SourceOnboardingStatus, SourceOnboardingStatus[]> = {
  submitted: ['probing', 'review_required', 'rejected'],
  probing: ['discovered', 'review_required', 'rejected'],
  discovered: ['config_generated', 'review_required', 'rejected'],
  config_generated: ['dry_run', 'review_required', 'rejected'],
  dry_run: ['review_required', 'ready', 'rejected'],
  review_required: ['ready', 'rejected', 'enabled'],
  ready: ['enabled', 'review_required', 'rejected'],
  enabled: ['review_required'],
  rejected: ['submitted'],
};

export function canTransitionOnboardingStatus(
  from: SourceOnboardingStatus,
  to: SourceOnboardingStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertOnboardingStatusTransition(
  from: SourceOnboardingStatus,
  to: SourceOnboardingStatus,
): void {
  if (!canTransitionOnboardingStatus(from, to)) {
    throw new Error(`Invalid onboarding status transition: ${from} -> ${to}`);
  }
}
