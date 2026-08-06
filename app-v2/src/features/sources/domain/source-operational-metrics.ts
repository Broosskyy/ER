import type { ImportJobStatus } from '@/features/import/models/statuses';
import type { ImportJob } from '@/features/import/models/types';
import type { ImportRecord } from '@/features/import/models/types';
import type { AdminEventRecord } from '@/data/types/records';
import type { SourceReference } from '@/features/aggregation/identity/event-identity';

/** Terminal import job statuses that represent a finished execution. */
const TERMINAL_JOB_STATUSES: ImportJobStatus[] = [
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
];

const SUCCESS_JOB_STATUSES: ImportJobStatus[] = ['completed', 'completed_with_warnings'];

export interface SourceOperationalMetricsSnapshot {
  /** Latest import records per external id for this source. */
  totalImportCount: number;
  /** Active origins linked to non-archived canonical events. */
  totalValidEventCount: number;
  /** Import records with status rejected. */
  totalRejectedEventCount: number;
  /** Finished timestamp of the most recent terminal import job, if any. */
  lastImportAt?: string;
  /** Status of the most recent terminal import job, if any. */
  lastJobStatus?: ImportJobStatus;
  /** Finished timestamp of the most recent failed job, if any. */
  lastFailedImportAt?: string;
  /** Consecutive failed terminal jobs from newest backwards. */
  consecutiveFailureCount: number;
}

export interface ComputeSourceOperationalMetricsInput {
  importRecords: ImportRecord[];
  importJobs: ImportJob[];
  origins: SourceReference[];
  eventsById: Map<string, AdminEventRecord>;
}

export function computeSourceOperationalMetrics(
  input: ComputeSourceOperationalMetricsInput,
): SourceOperationalMetricsSnapshot {
  const { importRecords, importJobs, origins, eventsById } = input;

  const totalImportCount = importRecords.length;
  const totalRejectedEventCount = importRecords.filter((record) => record.status === 'rejected').length;

  const activeOriginEventIds = new Set<string>();
  for (const origin of origins) {
    if (!origin.active) {
      continue;
    }
    const canonicalEventId = origin.canonicalEventId;
    if (!canonicalEventId) {
      continue;
    }
    const event = eventsById.get(canonicalEventId);
    if (!event || event.status === 'archived') {
      continue;
    }
    activeOriginEventIds.add(canonicalEventId);
  }

  const terminalJobs = importJobs
    .filter((job) => TERMINAL_JOB_STATUSES.includes(job.status))
    .sort((a, b) => {
      const aTime = a.finishedAt ?? a.updatedAt ?? a.createdAt;
      const bTime = b.finishedAt ?? b.updatedAt ?? b.createdAt;
      return bTime.localeCompare(aTime);
    });

  const latestJob = terminalJobs[0];
  const lastImportAt = latestJob?.finishedAt ?? latestJob?.updatedAt;
  const lastJobStatus = latestJob?.status;

  const latestFailedJob = terminalJobs.find((job) => job.status === 'failed');
  const lastFailedImportAt = latestFailedJob?.finishedAt ?? latestFailedJob?.updatedAt;

  let consecutiveFailureCount = 0;
  for (const job of terminalJobs) {
    if (job.status === 'failed') {
      consecutiveFailureCount += 1;
      continue;
    }
    if (SUCCESS_JOB_STATUSES.includes(job.status)) {
      break;
    }
    if (job.status === 'cancelled') {
      break;
    }
  }

  return {
    totalImportCount,
    totalValidEventCount: activeOriginEventIds.size,
    totalRejectedEventCount,
    lastImportAt,
    lastJobStatus,
    lastFailedImportAt,
    consecutiveFailureCount,
  };
}

export function metricsChanged(
  before: Pick<
    SourceOperationalMetricsSnapshot,
    | 'totalImportCount'
    | 'totalValidEventCount'
    | 'totalRejectedEventCount'
    | 'lastImportAt'
    | 'lastJobStatus'
    | 'lastFailedImportAt'
    | 'consecutiveFailureCount'
  >,
  after: SourceOperationalMetricsSnapshot,
): boolean {
  return (
    before.totalImportCount !== after.totalImportCount ||
    before.totalValidEventCount !== after.totalValidEventCount ||
    before.totalRejectedEventCount !== after.totalRejectedEventCount ||
    before.lastImportAt !== after.lastImportAt ||
    before.lastJobStatus !== after.lastJobStatus ||
    before.lastFailedImportAt !== after.lastFailedImportAt ||
    before.consecutiveFailureCount !== after.consecutiveFailureCount
  );
}
