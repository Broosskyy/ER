export type ModerationQueueStatus =
  | 'pending'
  | 'in_review'
  | 'needs_changes'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived';

export type ModerationReasonCode =
  | 'incomplete_data'
  | 'invalid_data'
  | 'wrong_region'
  | 'duplicate_suspected'
  | 'policy_violation'
  | 'quality_issue'
  | 'other';

export interface EventModerationStateRecord {
  eventId: string;
  queueStatus: ModerationQueueStatus;
  reasonCode?: ModerationReasonCode;
  note?: string;
  markedBy?: string;
  updatedAt: string;
}

export type DuplicateReviewDecision = 'same_event' | 'different_event' | 'deferred';

export interface DuplicateReviewRecord {
  eventId: string;
  candidateEventId: string;
  decision: DuplicateReviewDecision;
  note?: string;
  decidedBy: string;
  decidedAt: string;
}
