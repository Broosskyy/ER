/** Default event duration when endAt is missing (4 hours). Genre-independent baseline. */
export const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000;

/** Archive events this long after they ended. */
export const ARCHIVE_AFTER_ENDED_MS = 90 * 24 * 60 * 60 * 1000;

export type LifecycleStatus =
  | 'draft'
  | 'needs_review'
  | 'scheduled'
  | 'on_sale'
  | 'sold_out'
  | 'cancelled'
  | 'postponed'
  | 'happening_now'
  | 'ended'
  | 'archived';

export interface EventLifecycleInput {
  editorialStatus: 'draft' | 'review' | 'published' | 'rejected' | 'archived';
  timezone: string;
  startAt: string;
  endAt?: string;
  doorsOpenAt?: string;
  salesStartAt?: string;
  salesEndAt?: string;
  cancelledAt?: string;
  postponedAt?: string;
  publishedAt?: string;
  ticketStatus?: 'not_configured' | 'external_link' | 'on_sale' | 'sold_out' | 'sales_ended';
}

export interface EventLifecycleResult {
  status: LifecycleStatus;
  effectiveEndAt: string;
  reasonCodes: string[];
}
