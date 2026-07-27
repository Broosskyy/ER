import type { BadgeStatus } from '@/components/feedback/badge-styles';

import type { PermissionStatus } from './view-models';

const permissionBadgeStatus: Record<PermissionStatus, BadgeStatus> = {
  not_requested: 'default',
  granted: 'success',
  denied: 'error',
  limited: 'warning',
  unavailable: 'default',
};

const permissionLabels: Record<PermissionStatus, string> = {
  not_requested: 'Nicht angefragt',
  granted: 'Erlaubt',
  denied: 'Abgelehnt',
  limited: 'Eingeschränkt',
  unavailable: 'Nicht verfügbar',
};

export function resolvePermissionStatusLabel(status: PermissionStatus): string {
  return permissionLabels[status];
}

export function resolvePermissionBadgeStatus(status: PermissionStatus): BadgeStatus {
  return permissionBadgeStatus[status];
}

export type AuthNoticeKind =
  | 'error'
  | 'success'
  | 'email_sent'
  | 'verification_required'
  | 'session_expired'
  | 'account_exists'
  | 'rate_limit';

export function resolveAuthNoticeBannerVariant(
  kind: AuthNoticeKind,
): 'error' | 'success' | 'warning' | 'info' {
  if (kind === 'success' || kind === 'email_sent') return 'success';
  if (kind === 'verification_required') return 'warning';
  if (kind === 'error' || kind === 'account_exists' || kind === 'rate_limit' || kind === 'session_expired') {
    return 'error';
  }
  return 'info';
}
