export const ADMIN_DASHBOARD_ROUTE = '/admin' as const;
export const ADMIN_REVIEW_QUEUE_ROUTE = '/admin/events/review' as const;
export const ADMIN_SOURCES_ROUTE = '/admin/sources' as const;

export function buildAdminReviewDetailRoute(eventId: string): `/admin/events/review/${string}` {
  return `/admin/events/review/${eventId}`;
}

export function buildAdminDuplicateReviewRoute(eventId: string): `/admin/events/review/${string}/duplicates` {
  return `/admin/events/review/${eventId}/duplicates`;
}

export function buildAdminReviewQueueFilterRoute(
  filter: 'pending' | 'in_review' | 'needs_changes' | 'approved' | 'published' | 'rejected',
): `${typeof ADMIN_REVIEW_QUEUE_ROUTE}?filter=${typeof filter}` {
  return `${ADMIN_REVIEW_QUEUE_ROUTE}?filter=${filter}`;
}
