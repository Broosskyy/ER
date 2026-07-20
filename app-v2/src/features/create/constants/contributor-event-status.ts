import type { AdminEventStatus } from '@/data/types/records';

/** Consumer-allowed status transitions. */
export const CONTRIBUTOR_ALLOWED_TRANSITIONS: Readonly<
  Record<AdminEventStatus, readonly AdminEventStatus[]>
> = {
  draft: ['review'],
  review: ['draft'],
  published: [],
  rejected: [],
  archived: [],
};

export function canContributorTransition(
  from: AdminEventStatus,
  to: AdminEventStatus,
): boolean {
  return (CONTRIBUTOR_ALLOWED_TRANSITIONS[from] as readonly string[]).includes(to);
}
