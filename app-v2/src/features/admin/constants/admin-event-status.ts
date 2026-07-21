import type { AdminEventStatus } from '@/data/types/records';

/** Contributor submission moderation: review queue outcomes only. */
export const ADMIN_MODERATION_TRANSITIONS: Readonly<
  Record<'review', readonly AdminEventStatus[]>
> = {
  review: ['published', 'rejected'],
};

/** Broader CMS transitions for admin editors (not contributor-owned review events). */
export const ADMIN_EDITORIAL_TRANSITIONS: Readonly<
  Record<AdminEventStatus, readonly AdminEventStatus[]>
> = {
  draft: ['review', 'published', 'archived'],
  review: ['published', 'rejected', 'draft', 'archived'],
  published: ['archived'],
  rejected: ['draft', 'archived'],
  archived: [],
};

export function canAdminModerateTransition(
  from: AdminEventStatus,
  to: AdminEventStatus,
): boolean {
  if (from !== 'review') {
    return false;
  }

  return (ADMIN_MODERATION_TRANSITIONS.review as readonly string[]).includes(to);
}

export function canAdminEditorialTransition(
  from: AdminEventStatus,
  to: AdminEventStatus,
): boolean {
  return (ADMIN_EDITORIAL_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function isContributorSubmission(record: { createdBy?: string }): boolean {
  return Boolean(record.createdBy?.trim());
}
