import type { AdminEventRecord } from '@/data/types/records';
import type { ModerationQueueStatus } from '@/features/admin/types/moderation-types';
import type { SubmissionDisplayStatus } from '@/features/create/wizard/wizard-types';

export function mapModerationQueueToSubmissionStatus(
  queueStatus: ModerationQueueStatus,
): SubmissionDisplayStatus {
  if (queueStatus === 'pending') {
    return 'pending';
  }
  if (queueStatus === 'in_review') {
    return 'in_review';
  }
  if (queueStatus === 'needs_changes') {
    return 'needs_changes';
  }
  if (queueStatus === 'approved') {
    return 'approved';
  }
  if (queueStatus === 'published') {
    return 'published';
  }
  if (queueStatus === 'rejected') {
    return 'rejected';
  }
  return 'archived';
}

export function resolveModerationQueueStatus(
  event: AdminEventRecord,
  stateQueueStatus?: ModerationQueueStatus | null,
): ModerationQueueStatus {
  if (event.status === 'published') {
    return 'published';
  }
  if (event.status === 'archived') {
    return 'archived';
  }
  if (stateQueueStatus) {
    return stateQueueStatus;
  }
  if (event.status === 'rejected') {
    return 'rejected';
  }
  if (event.status === 'review') {
    return 'pending';
  }
  return 'pending';
}
