import type { BadgeStatus } from '@/components/feedback/badge-styles';

import type {
  IntegrationStatus,
  OrganizerVerificationStatus,
  SubmissionStatus,
  TeamInviteStatus,
} from './view-models';

const submissionStatusLabels: Record<SubmissionStatus, string> = {
  draft: 'Entwurf',
  incomplete: 'Unvollständig',
  ready_for_review: 'Bereit zur Prüfung',
  submitted: 'Eingereicht',
  changes_requested: 'Änderungen angefordert',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  published: 'Veröffentlicht',
};

const submissionBadgeStatus: Record<SubmissionStatus, BadgeStatus> = {
  draft: 'default',
  incomplete: 'warning',
  ready_for_review: 'info',
  submitted: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'error',
  published: 'success',
};

const integrationStatusLabels: Record<IntegrationStatus, string> = {
  connected: 'Verbunden',
  disconnected: 'Getrennt',
  error: 'Fehler',
  syncing: 'Synchronisiert',
  needs_attention: 'Aktion erforderlich',
};

const integrationBadgeStatus: Record<IntegrationStatus, BadgeStatus> = {
  connected: 'success',
  disconnected: 'default',
  error: 'error',
  syncing: 'info',
  needs_attention: 'warning',
};

const verificationStatusLabels: Record<OrganizerVerificationStatus, string> = {
  not_started: 'Nicht gestartet',
  incomplete: 'Unvollständig',
  under_review: 'In Prüfung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  changes_requested: 'Änderungen angefordert',
};

const verificationBadgeStatus: Record<OrganizerVerificationStatus, BadgeStatus> = {
  not_started: 'default',
  incomplete: 'warning',
  under_review: 'info',
  approved: 'success',
  rejected: 'error',
  changes_requested: 'warning',
};

const inviteStatusLabels: Record<TeamInviteStatus, string> = {
  pending: 'Ausstehend',
  accepted: 'Angenommen',
  expired: 'Abgelaufen',
  revoked: 'Widerrufen',
};

const inviteBadgeStatus: Record<TeamInviteStatus, BadgeStatus> = {
  pending: 'warning',
  accepted: 'success',
  expired: 'default',
  revoked: 'error',
};

const teamRoleLabels = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  promoter: 'Promoter',
  viewer: 'Viewer',
} as const;

const teamRoleBadgeStatus: Record<keyof typeof teamRoleLabels, BadgeStatus> = {
  owner: 'info',
  admin: 'info',
  editor: 'success',
  promoter: 'success',
  viewer: 'default',
};

export function resolveSubmissionStatusLabel(status: SubmissionStatus): string {
  return submissionStatusLabels[status];
}

export function resolveSubmissionBadgeStatus(status: SubmissionStatus): BadgeStatus {
  return submissionBadgeStatus[status];
}

export function resolveIntegrationStatusLabel(status: IntegrationStatus): string {
  return integrationStatusLabels[status];
}

export function resolveIntegrationBadgeStatus(status: IntegrationStatus): BadgeStatus {
  return integrationBadgeStatus[status];
}

export function resolveVerificationStatusLabel(status: OrganizerVerificationStatus): string {
  return verificationStatusLabels[status];
}

export function resolveVerificationBadgeStatus(status: OrganizerVerificationStatus): BadgeStatus {
  return verificationBadgeStatus[status];
}

export function resolveInviteStatusLabel(status: TeamInviteStatus): string {
  return inviteStatusLabels[status];
}

export function resolveInviteBadgeStatus(status: TeamInviteStatus): BadgeStatus {
  return inviteBadgeStatus[status];
}

export function resolveTeamRoleLabel(role: keyof typeof teamRoleLabels): string {
  return teamRoleLabels[role];
}

export function resolveTeamRoleBadgeStatus(role: keyof typeof teamRoleLabels): BadgeStatus {
  return teamRoleBadgeStatus[role];
}

export function resolveSubmissionBannerVariant(
  status: SubmissionStatus,
): 'info' | 'success' | 'warning' | 'error' {
  if (status === 'approved' || status === 'published') return 'success';
  if (status === 'rejected') return 'error';
  if (status === 'changes_requested' || status === 'incomplete') return 'warning';
  return 'info';
}
