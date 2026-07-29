import type { LifecycleChangeSeverity, LifecycleDecision } from './lifecycle-engine-types';

export interface LifecycleFieldRule {
  fieldPath: string;
  severity: LifecycleChangeSeverity;
  reviewOnPublished: boolean;
  minTrustScoreForAutoApply: number;
}

export const DEFAULT_LIFECYCLE_FIELD_RULES: LifecycleFieldRule[] = [
  { fieldPath: 'startDate', severity: 'critical', reviewOnPublished: true, minTrustScoreForAutoApply: 85 },
  { fieldPath: 'endDate', severity: 'warning', reviewOnPublished: true, minTrustScoreForAutoApply: 75 },
  { fieldPath: 'venueName', severity: 'warning', reviewOnPublished: true, minTrustScoreForAutoApply: 70 },
  { fieldPath: 'venueId', severity: 'warning', reviewOnPublished: true, minTrustScoreForAutoApply: 70 },
  { fieldPath: 'organizerName', severity: 'info', reviewOnPublished: false, minTrustScoreForAutoApply: 60 },
  { fieldPath: 'organizerId', severity: 'info', reviewOnPublished: false, minTrustScoreForAutoApply: 60 },
  { fieldPath: 'festivalEditionId', severity: 'warning', reviewOnPublished: true, minTrustScoreForAutoApply: 75 },
  { fieldPath: 'ticketUrl', severity: 'info', reviewOnPublished: false, minTrustScoreForAutoApply: 60 },
  { fieldPath: 'description', severity: 'info', reviewOnPublished: false, minTrustScoreForAutoApply: 50 },
  { fieldPath: 'imageUrl', severity: 'info', reviewOnPublished: false, minTrustScoreForAutoApply: 50 },
  { fieldPath: 'cancelledAt', severity: 'critical', reviewOnPublished: true, minTrustScoreForAutoApply: 80 },
  { fieldPath: 'postponedAt', severity: 'critical', reviewOnPublished: true, minTrustScoreForAutoApply: 80 },
  { fieldPath: 'status', severity: 'critical', reviewOnPublished: true, minTrustScoreForAutoApply: 80 },
];

export function resolveLifecycleFieldRule(fieldPath: string): LifecycleFieldRule {
  return (
    DEFAULT_LIFECYCLE_FIELD_RULES.find((rule) => rule.fieldPath === fieldPath) ?? {
      fieldPath,
      severity: 'info',
      reviewOnPublished: false,
      minTrustScoreForAutoApply: 60,
    }
  );
}

export function resolveLifecycleDecision(input: {
  changeSeverity: LifecycleChangeSeverity;
  isPublished: boolean;
  trustScore: number;
  hasExistingConflict: boolean;
  rule: LifecycleFieldRule;
}): LifecycleDecision {
  if (input.hasExistingConflict) {
    return 'create_conflict';
  }
  if (input.isPublished && input.rule.reviewOnPublished && input.trustScore < input.rule.minTrustScoreForAutoApply) {
    return 'review_required';
  }
  if (input.changeSeverity === 'critical' && input.isPublished && input.trustScore < 90) {
    return 'review_required';
  }
  return 'apply_immediately';
}
