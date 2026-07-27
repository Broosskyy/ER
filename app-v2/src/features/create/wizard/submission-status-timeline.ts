import type { SubmissionStepViewModel } from '@/components/organizer/view-models';
import type { AdminEventRecord } from '@/data/types/records';

import type { EventSubmission, SubmissionDisplayStatus } from './wizard-types';

export const SUBMISSION_TIMELINE_ORDER: SubmissionDisplayStatus[] = [
  'draft',
  'pending',
  'in_review',
  'needs_changes',
  'resubmitted',
  'approved',
  'published',
  'archived',
];

const TIMELINE_LABELS: Record<SubmissionDisplayStatus, string> = {
  draft: 'Entwurf',
  pending: 'Eingereicht',
  in_review: 'In Prüfung',
  needs_changes: 'Änderungen erforderlich',
  resubmitted: 'Erneut eingereicht',
  approved: 'Genehmigt',
  published: 'Veröffentlicht',
  rejected: 'Abgelehnt',
  cancelled: 'Zurückgezogen',
  archived: 'Archiviert',
};

export function resolveSubmissionTimelineLabel(status: SubmissionDisplayStatus): string {
  return TIMELINE_LABELS[status];
}

function resolveStepState(
  stepStatus: SubmissionDisplayStatus,
  currentStatus: SubmissionDisplayStatus,
): SubmissionStepViewModel['state'] {
  const currentIndex = SUBMISSION_TIMELINE_ORDER.indexOf(currentStatus);
  const stepIndex = SUBMISSION_TIMELINE_ORDER.indexOf(stepStatus);

  if (stepIndex < 0) {
    return 'skipped';
  }

  if (currentStatus === 'needs_changes' && stepStatus === 'needs_changes') {
    return 'error';
  }

  if (currentStatus === 'rejected' && stepStatus === 'needs_changes') {
    return 'error';
  }

  if (stepIndex < currentIndex) {
    return 'completed';
  }

  if (stepIndex === currentIndex) {
    return 'active';
  }

  return 'upcoming';
}

export function buildSubmissionTimelineSteps(
  currentStatus: SubmissionDisplayStatus,
): SubmissionStepViewModel[] {
  const visibleSteps = SUBMISSION_TIMELINE_ORDER.filter((status) => {
    if (status === 'needs_changes' && currentStatus !== 'needs_changes' && currentStatus !== 'rejected') {
      return false;
    }
    if (status === 'resubmitted' && currentStatus !== 'resubmitted') {
      return false;
    }
    return true;
  });

  return visibleSteps.map((status, index) => ({
    id: status,
    index: index + 1,
    label: resolveSubmissionTimelineLabel(status),
    state: resolveStepState(status, currentStatus),
  }));
}

export function resolveSubmissionDisplayStatus(
  submission: EventSubmission,
  event?: AdminEventRecord | null,
): SubmissionDisplayStatus {
  if (event?.status === 'published') {
    return 'published';
  }
  if (event?.status === 'archived') {
    return 'archived';
  }
  if (event?.status === 'rejected') {
    return 'needs_changes';
  }
  if (event?.status === 'review' && submission.status === 'pending') {
    return 'in_review';
  }

  return submission.status;
}

export function buildSubmissionFromAdminEvent(event: AdminEventRecord): EventSubmission {
  const now = event.updatedAt;
  const status: SubmissionDisplayStatus =
    event.status === 'published'
      ? 'published'
      : event.status === 'archived'
        ? 'archived'
        : event.status === 'rejected'
          ? 'needs_changes'
          : event.status === 'review'
            ? 'in_review'
            : 'draft';

  return {
    id: `submission-${event.id}`,
    eventId: event.id,
    draftId: `legacy-${event.id}`,
    organizerId: event.createdBy ?? '',
    status,
    submittedAt: event.createdAt,
    updatedAt: now,
    eventSnapshot: event as unknown as Record<string, unknown>,
    history: [{ status, at: now }],
  };
}
