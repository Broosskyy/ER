import type { AdminEventRecord } from '@/data/types/records';
import type { EventSubmission } from '@/features/create/wizard/wizard-types';

export type MyEventsFilter =
  | 'all'
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_changes'
  | 'published'
  | 'archived';

export const MY_EVENTS_FILTER_OPTIONS: MyEventsFilter[] = [
  'all',
  'draft',
  'submitted',
  'in_review',
  'needs_changes',
  'published',
  'archived',
];

export function resolveMyEventCategory(
  event: AdminEventRecord,
  submission?: EventSubmission | null,
): Exclude<MyEventsFilter, 'all'> {
  if (event.status === 'draft') {
    return 'draft';
  }
  if (event.status === 'published') {
    return 'published';
  }
  if (event.status === 'archived') {
    return 'archived';
  }
  if (event.status === 'rejected') {
    return 'needs_changes';
  }

  if (event.status === 'review') {
    if (submission?.status === 'in_review') {
      return 'in_review';
    }
    return 'submitted';
  }

  return 'draft';
}

export function filterMyEventsByStatus(
  events: AdminEventRecord[],
  filter: MyEventsFilter,
  submissionsByEventId: Record<string, EventSubmission | undefined> = {},
): AdminEventRecord[] {
  if (filter === 'all') {
    return events;
  }

  return events.filter((event) => {
    const submission = submissionsByEventId[event.id];
    return resolveMyEventCategory(event, submission) === filter;
  });
}

export function indexSubmissionsByEventId(
  submissions: EventSubmission[],
): Record<string, EventSubmission> {
  return submissions.reduce<Record<string, EventSubmission>>((accumulator, submission) => {
    accumulator[submission.eventId] = submission;
    return accumulator;
  }, {});
}
