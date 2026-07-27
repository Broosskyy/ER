/** Consumer create flow (implemented). */
export const CONTRIBUTOR_EVENT_CREATE_ROUTE = '/create/event' as const;

export const PROFILE_MY_EVENTS_ROUTE = '/profile/events' as const;

export const PROFILE_ORGANIZER_ROUTE = '/profile/organizer' as const;

export const CONTRIBUTOR_EVENT_SUCCESS_ROUTE = '/create/event/success' as const;

export const CONTRIBUTOR_EVENT_SUBMITTED_ROUTE = '/create/event/submitted' as const;

export function buildContributorEventSuccessHref(eventId: string): string {
  return `${CONTRIBUTOR_EVENT_SUCCESS_ROUTE}?id=${encodeURIComponent(eventId)}`;
}

export function buildContributorEventSubmittedHref(eventId: string): string {
  return `${CONTRIBUTOR_EVENT_SUBMITTED_ROUTE}?id=${encodeURIComponent(eventId)}`;
}

export function getContributorEventEditRoute(eventId: string): `/event/${string}/edit` {
  return `/event/${eventId}/edit`;
}

export function getContributorEventPreviewRoute(eventId: string): `/event/${string}/preview` {
  return `/event/${eventId}/preview`;
}

export function buildEventSubmissionStatusRoute(
  submissionOrEventId: string,
): `/create/event/status/${string}` {
  return `/create/event/status/${submissionOrEventId}`;
}
