import type { BadgeStatus } from '@/components/feedback/badge-styles';

import type { DuplicateFieldState, ReviewStatus, SourceStatus } from './view-models';

const reviewStatusLabels: Record<ReviewStatus, string> = {
  pending: 'Pending',
  in_review: 'In Prüfung',
  approved: 'Genehmigt',
  changes_requested: 'Änderungen angefordert',
  rejected: 'Abgelehnt',
  escalated: 'Eskaliert',
};

const reviewBadgeStatus: Record<ReviewStatus, BadgeStatus> = {
  pending: 'warning',
  in_review: 'info',
  approved: 'success',
  changes_requested: 'warning',
  rejected: 'error',
  escalated: 'error',
};

const sourceStatusLabels: Record<SourceStatus, string> = {
  active: 'Aktiv',
  paused: 'Pausiert',
  error: 'Fehler',
  syncing: 'Sync läuft',
  rate_limited: 'Rate Limit',
  disabled: 'Deaktiviert',
};

const sourceBadgeStatus: Record<SourceStatus, BadgeStatus> = {
  active: 'success',
  paused: 'default',
  error: 'error',
  syncing: 'info',
  rate_limited: 'warning',
  disabled: 'default',
};

const duplicateFieldLabels: Record<DuplicateFieldState, string> = {
  equal: 'Gleich',
  different: 'Abweichend',
  missing: 'Fehlt',
  conflict: 'Konflikt',
};

const duplicateFieldBadgeStatus: Record<DuplicateFieldState, BadgeStatus> = {
  equal: 'success',
  different: 'warning',
  missing: 'default',
  conflict: 'error',
};

export function resolveReviewStatusLabel(status: ReviewStatus): string {
  return reviewStatusLabels[status];
}

export function resolveReviewBadgeStatus(status: ReviewStatus): BadgeStatus {
  return reviewBadgeStatus[status];
}

export function resolveSourceStatusLabel(status: SourceStatus): string {
  return sourceStatusLabels[status];
}

export function resolveSourceBadgeStatus(status: SourceStatus): BadgeStatus {
  return sourceBadgeStatus[status];
}

export function resolveDuplicateFieldLabel(state: DuplicateFieldState): string {
  return duplicateFieldLabels[state];
}

export function resolveDuplicateFieldBadgeStatus(state: DuplicateFieldState): BadgeStatus {
  return duplicateFieldBadgeStatus[state];
}
