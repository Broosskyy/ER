import { EventRow, EventSubmissionRow, ImportSourceRow } from '@/types/database';
import { fetchReportCount } from './profiles';
import { fetchReviewEvents, fetchPublishedEvents, updateEventLifecycle } from './events';
import { fetchAllSubmissions, updateSubmissionStatus } from './submissions';
import { fetchImportSources } from './imports';
import { ServiceResult } from './types';
import { EventSubmission } from '@/types/lifecycle';
import { fromDbLifecycleStatus } from '@/utils/lifecycleMap';

export interface ReviewQueueData {
  reviewEvents: EventRow[];
  submissions: EventSubmissionRow[];
  importSources: ImportSourceRow[];
  openReports: number;
}

export interface AdminStatsSnapshot {
  totalPublished: number;
  pendingReview: number;
  imported: number;
  approved: number;
  rejected: number;
  duplicates: number;
  openReports: number;
}

export async function fetchReviewQueue(): Promise<ServiceResult<ReviewQueueData>> {
  const [reviewEvents, submissions, imports, reports] = await Promise.all([
    fetchReviewEvents(),
    fetchAllSubmissions(),
    fetchImportSources(),
    fetchReportCount(),
  ]);

  if (reviewEvents.error) return { data: null, error: reviewEvents.error, offline: false };
  if (submissions.error) return { data: null, error: submissions.error, offline: false };
  if (imports.error) return { data: null, error: imports.error, offline: false };

  return {
    data: {
      reviewEvents: reviewEvents.data ?? [],
      submissions: submissions.data ?? [],
      importSources: imports.data ?? [],
      openReports: reports.data ?? 0,
    },
    error: null,
    offline: reviewEvents.offline || submissions.offline || imports.offline,
  };
}

export async function fetchAdminStatsSnapshot(): Promise<ServiceResult<AdminStatsSnapshot>> {
  const [published, review] = await Promise.all([fetchPublishedEvents(), fetchReviewEvents()]);
  if (published.error) return { data: null, error: published.error, offline: false };
  if (review.error) return { data: null, error: review.error, offline: false };

  const rows = review.data ?? [];
  const pending = rows.filter((e) =>
    ['pending_review', 'imported_draft', 'needs_review', 'draft'].includes(e.lifecycle_status)
  ).length;
  const approved = rows.filter((e) => e.lifecycle_status === 'approved').length;
  const rejected = rows.filter((e) => e.lifecycle_status === 'rejected').length;
  const duplicates = rows.filter((e) => e.lifecycle_status === 'duplicate').length;
  const imported = rows.filter(
    (e) => e.source_type && !['user_submission', 'organizer'].includes(e.source_type ?? '')
  ).length;

  const reports = await fetchReportCount();

  return {
    data: {
      totalPublished: published.data?.length ?? 0,
      pendingReview: pending,
      imported,
      approved,
      rejected,
      duplicates,
      openReports: reports.data ?? 0,
    },
    error: null,
    offline: published.offline || review.offline,
  };
}

export async function approveEvent(eventId: string, adminUserId: string): Promise<ServiceResult<EventRow>> {
  return updateEventLifecycle(eventId, 'approved', adminUserId);
}

export async function publishEvent(eventId: string, adminUserId: string): Promise<ServiceResult<EventRow>> {
  return updateEventLifecycle(eventId, 'published', adminUserId);
}

export async function rejectEvent(eventId: string, adminUserId: string): Promise<ServiceResult<EventRow>> {
  return updateEventLifecycle(eventId, 'rejected', adminUserId);
}

export async function markEventDuplicate(eventId: string, adminUserId: string): Promise<ServiceResult<EventRow>> {
  return updateEventLifecycle(eventId, 'duplicate', adminUserId);
}

export async function updateSubmissionReviewStatus(
  submissionId: string,
  status: EventSubmission['status']
): Promise<ServiceResult<EventSubmissionRow>> {
  return updateSubmissionStatus(submissionId, status);
}

/** Non-published lifecycle statuses — must never appear in public feed queries. */
export const NON_PUBLIC_LIFECYCLE_STATUSES = [
  'draft',
  'pending_review',
  'imported_draft',
  'needs_review',
  'approved',
  'rejected',
  'duplicate',
] as const;

export function isPublicLifecycle(status: string): boolean {
  return fromDbLifecycleStatus(status as EventRow['lifecycle_status']) === 'Published'
    || status === 'published';
}
