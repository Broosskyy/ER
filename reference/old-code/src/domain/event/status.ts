import { DbLifecycleStatus } from '@/types/database';

/** Sprint 3 primary lifecycle path */
export const EVENT_STATUS_FLOW = [
  'draft',
  'pending_review',
  'approved',
  'published',
  'rejected',
  'archived',
  'deleted',
] as const satisfies readonly DbLifecycleStatus[];

/** Band 4.5 automation / import statuses (retained) */
export const EVENT_STATUS_AUTOMATION = [
  'imported_draft',
  'needs_review',
  'duplicate',
] as const satisfies readonly DbLifecycleStatus[];

export const ALL_EVENT_STATUSES: DbLifecycleStatus[] = [
  ...EVENT_STATUS_FLOW,
  ...EVENT_STATUS_AUTOMATION,
];

export type ReviewAction = 'approve' | 'reject' | 'request_changes' | 'publish' | 'archive' | 'delete';

/** Allowed transitions — enforced in eventLifecycleService */
export const LIFECYCLE_TRANSITIONS: Record<DbLifecycleStatus, DbLifecycleStatus[]> = {
  draft: ['pending_review', 'deleted'],
  pending_review: ['approved', 'rejected', 'needs_review', 'deleted'],
  imported_draft: ['pending_review', 'needs_review', 'deleted'],
  needs_review: ['approved', 'rejected', 'pending_review', 'duplicate', 'deleted'],
  approved: ['published', 'rejected', 'pending_review', 'archived'],
  published: ['archived', 'deleted'],
  rejected: ['archived', 'pending_review', 'deleted'],
  duplicate: ['archived', 'deleted'],
  archived: ['deleted', 'draft'],
  deleted: [],
};

export function canTransition(from: DbLifecycleStatus, to: DbLifecycleStatus): boolean {
  if (from === to) return true;
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: DbLifecycleStatus, to: DbLifecycleStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lifecycle transition: ${from} → ${to}`);
  }
}

export function isPublicStatus(status: DbLifecycleStatus): boolean {
  return status === 'published';
}

export function isDraftStatus(status: DbLifecycleStatus): boolean {
  return status === 'draft' || status === 'imported_draft';
}

export function isReviewQueueStatus(status: DbLifecycleStatus): boolean {
  return ['pending_review', 'needs_review', 'approved'].includes(status);
}

export function isTerminalStatus(status: DbLifecycleStatus): boolean {
  return status === 'deleted' || status === 'archived';
}
