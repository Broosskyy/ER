import type { ImageSourcePropType } from 'react-native';

import type { AppIconName } from '@/components/primitives/AppIcon';
import type { VerificationStatus } from '@/components/profiles/view-models';
import type { TeamMemberRole } from '@/components/profiles/view-models';

/** Presentation contracts for organizer dashboard and management UI. */

export type OrganizerMetricKind =
  | 'events'
  | 'views'
  | 'saves'
  | 'ticket_clicks'
  | 'followers'
  | 'conversion'
  | 'revenue'
  | 'pending'
  | 'tickets_sold'
  | 'visitors'
  | 'pending_events'
  | 'pending_organizers'
  | 'duplicate_candidates'
  | 'failed_sources'
  | 'reports'
  | 'active_users'
  | 'total_events'
  | 'total_users';

export interface OrganizerMetricViewModel {
  id: string;
  kind: OrganizerMetricKind;
  label: string;
  valueLabel: string;
  changeLabel?: string;
  changeDirection?: 'up' | 'down' | 'neutral';
  icon?: AppIconName;
  loading?: boolean;
  unavailable?: boolean;
  accessibilityLabel: string;
}

export interface OrganizerDashboardViewModel {
  organizerName: string;
  verificationStatus: VerificationStatus;
  periodLabel?: string;
  logo?: ImageSourcePropType;
  accessibilityLabel: string;
}

export type OrganizerQuickActionKind =
  | 'create_event'
  | 'continue_draft'
  | 'edit_profile'
  | 'manage_team'
  | 'add_integration'
  | 'submissions'
  | 'statistics'
  | 'settings'
  | 'marketing'
  | 'reports';

export interface OrganizerQuickActionViewModel {
  id: string;
  kind: OrganizerQuickActionKind;
  title: string;
  description?: string;
  icon: AppIconName;
  accessibilityLabel: string;
}

export type OrganizerActivityKind =
  | 'event_published'
  | 'event_updated'
  | 'ticket_status_changed'
  | 'team_member_added'
  | 'verification_updated';

export interface OrganizerActivityViewModel {
  id: string;
  kind: OrganizerActivityKind;
  title: string;
  subtitle?: string;
  timestampLabel: string;
  icon?: AppIconName;
  accessibilityLabel: string;
}

export type SubmissionStepState = 'completed' | 'active' | 'upcoming' | 'error' | 'skipped';

export interface SubmissionStepViewModel {
  id: string;
  index: number;
  label: string;
  state: SubmissionStepState;
}

export type SubmissionStatus =
  | 'draft'
  | 'incomplete'
  | 'ready_for_review'
  | 'submitted'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'published';

export interface SubmissionReviewViewModel {
  id: string;
  title: string;
  status: SubmissionStatus;
  completenessLabel?: string;
  warningLabel?: string;
  errorLabel?: string;
  accessibilityLabel: string;
}

export interface SubmissionFieldSummaryViewModel {
  id: string;
  label: string;
  valueLabel: string;
  icon?: AppIconName;
  missing?: boolean;
}

export interface EventDraftViewModel {
  id: string;
  title: string;
  cover?: ImageSourcePropType;
  lastEditedLabel: string;
  currentStep: number;
  totalSteps: number;
  status: SubmissionStatus;
  genreLabels?: string[];
  dateLabel?: string;
  venueLabel?: string;
  accessibilityLabel: string;
}

export type StatisticPeriod = '7d' | '30d' | '90d' | 'custom';

export interface StatisticViewModel {
  id: string;
  label: string;
  valueLabel: string;
  changeLabel?: string;
  changeDirection?: 'up' | 'down' | 'neutral';
  icon?: AppIconName;
  accessibilityLabel: string;
}

export interface StatisticTrendPointViewModel {
  label: string;
  value: number;
}

export interface StatisticTrendViewModel {
  id: string;
  title: string;
  valueLabel: string;
  changeLabel?: string;
  periodLabel: string;
  points: StatisticTrendPointViewModel[];
  accessibilityLabel: string;
}

export interface StatisticBreakdownViewModel {
  id: string;
  label: string;
  valueLabel: string;
  shareLabel?: string;
  accessibilityLabel: string;
}

export interface ProfileCompletionViewModel {
  percent: number;
  statusLabel: string;
  openItems: string[];
  ctaLabel?: string;
  accessibilityLabel: string;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'soundcloud' | 'website' | 'tiktok' | 'x';

export interface SocialLinkViewModel {
  id: string;
  platform: SocialPlatform;
  valueLabel: string;
  verified?: boolean;
  errorLabel?: string;
  accessibilityLabel: string;
}

export interface TeamMemberManagementViewModel {
  id: string;
  name: string;
  emailLabel: string;
  role: TeamMemberRole;
  statusLabel: string;
  avatar?: ImageSourcePropType;
  accessibilityLabel: string;
}

export type TeamInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TeamInviteViewModel {
  id: string;
  emailLabel: string;
  role: TeamMemberRole;
  status: TeamInviteStatus;
  sentLabel?: string;
  accessibilityLabel: string;
}

export type IntegrationProvider = 'ticketmaster' | 'eventbrite' | 'ra' | 'shotgun' | 'instagram' | 'facebook' | 'custom';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing' | 'needs_attention';

export interface IntegrationViewModel {
  id: string;
  provider: IntegrationProvider;
  name: string;
  description?: string;
  status: IntegrationStatus;
  lastSyncLabel?: string;
  accessibilityLabel: string;
}

export type VerificationRequirementKind =
  | 'identity'
  | 'organization'
  | 'website'
  | 'social'
  | 'event_ownership'
  | 'documents';

export type OrganizerVerificationStatus =
  | 'not_started'
  | 'incomplete'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested';

export interface VerificationRequirementViewModel {
  id: string;
  kind: VerificationRequirementKind;
  title: string;
  description?: string;
  status: 'complete' | 'open' | 'error';
  accessibilityLabel: string;
}

export interface VerificationDocumentViewModel {
  id: string;
  name: string;
  status: 'missing' | 'uploaded' | 'under_review' | 'approved' | 'rejected';
  accessibilityLabel: string;
}
