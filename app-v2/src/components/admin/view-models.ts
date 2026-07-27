import type { ImageSourcePropType } from 'react-native';

import type { AppIconName } from '@/components/primitives/AppIcon';
import type { OrganizerMetricViewModel } from '@/components/organizer/view-models';

/** Presentation contracts for admin dashboard, review, sources, and audit UI. */

export type AdminMetricKind =
  | 'pending_events'
  | 'pending_organizers'
  | 'duplicate_candidates'
  | 'failed_sources'
  | 'reports'
  | 'active_users'
  | 'total_events'
  | 'total_users';

export type AdminMetricViewModel = OrganizerMetricViewModel;

export type AdminQueueTab =
  | 'events'
  | 'organizers'
  | 'sources'
  | 'duplicates'
  | 'reports'
  | 'users';

export interface AdminQueueTabViewModel {
  id: AdminQueueTab;
  label: string;
  count?: number;
  active?: boolean;
}

export type ReviewType = 'event' | 'organizer' | 'report';

export type ReviewStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'escalated';

export interface AdminReviewViewModel {
  id: string;
  type: ReviewType;
  title: string;
  status: ReviewStatus;
  priorityLabel?: string;
  submittedByLabel?: string;
  timestampLabel: string;
  hintLabel?: string;
  thumbnail?: ImageSourcePropType;
  locationLabel?: string;
  dateLabel?: string;
  isNew?: boolean;
  accessibilityLabel: string;
}

export interface ReviewTimelineEntryViewModel {
  id: string;
  label: string;
  timestampLabel: string;
  status: 'completed' | 'active' | 'upcoming';
  actorLabel?: string;
}

export interface ReviewTimelineViewModel {
  id: string;
  entries: ReviewTimelineEntryViewModel[];
  accessibilityLabel: string;
}

export type SourceType = 'api' | 'scraper' | 'social' | 'manual' | 'feed';

export type SourceStatus = 'active' | 'paused' | 'error' | 'syncing' | 'rate_limited' | 'disabled';

export interface EventSourceViewModel {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceTypeLabel: string;
  urlLabel?: string;
  lastImportLabel?: string;
  status: SourceStatus;
  eventCountLabel?: string;
  errorCountLabel?: string;
  healthLabel?: string;
  logo?: ImageSourcePropType;
  icon?: AppIconName;
  accessibilityLabel: string;
}

export interface SourceHealthViewModel {
  successRateLabel?: string;
  lastSuccessLabel?: string;
  lastErrorLabel?: string;
  importCountLabel?: string;
  duplicateCountLabel?: string;
  accessibilityLabel: string;
}

export interface EventSummaryViewModel {
  id: string;
  title: string;
  dateLabel: string;
  venueLabel: string;
  cityLabel?: string;
  sourceLabel?: string;
  organizerLabel?: string;
}

export interface DuplicateCandidateViewModel {
  id: string;
  events: EventSummaryViewModel[];
  similarityScoreLabel: string;
  accessibilityLabel: string;
}

export type DuplicateFieldState = 'equal' | 'different' | 'missing' | 'conflict';

export interface DuplicateComparisonViewModel {
  fieldLabel: string;
  state: DuplicateFieldState;
  leftValueLabel?: string;
  rightValueLabel?: string;
}

export interface CanonicalEventViewModel {
  title: string;
  dateLabel: string;
  venueLabel: string;
  cityLabel?: string;
  sourceLabels?: string[];
  accessibilityLabel: string;
}

export interface SourceAttributionViewModel {
  sourceLabel: string;
  valueLabel: string;
  freshnessLabel?: string;
  priorityLabel?: string;
  accessibilityLabel: string;
}

export interface AuditLogViewModel {
  id: string;
  actorLabel: string;
  actionLabel: string;
  entityLabel: string;
  timestampLabel: string;
  reasonLabel?: string;
  previousStatusLabel?: string;
  newStatusLabel?: string;
  icon?: AppIconName;
  accessibilityLabel: string;
}
