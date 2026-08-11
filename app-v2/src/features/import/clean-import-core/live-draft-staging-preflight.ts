export interface LiveDraftQueueStateRow {
  id: string;
  status?: string | null;
  processingLeaseExpiresAt?: string | null;
  leaseExpiresAt?: string | null;
  lockedUntil?: string | null;
}

export interface LiveDraftQueuePreflightInput {
  queueRows: LiveDraftQueueStateRow[];
  importJobs: LiveDraftQueueStateRow[];
  workerRuns: LiveDraftQueueStateRow[];
  schedulerRuns: LiveDraftQueueStateRow[];
  scheduleLocks: LiveDraftQueueStateRow[];
  now: Date;
}

export interface LiveDraftQueuePreflightResult {
  allowed: boolean;
  queuedIds: string[];
  blockers: Array<{ kind: string; id: string; reason: string }>;
}

const ACTIVE_STATUSES = new Set(['active', 'processing', 'running', 'started']);

function hasActiveStatus(row: LiveDraftQueueStateRow): boolean {
  return ACTIVE_STATUSES.has(row.status?.trim().toLowerCase() ?? '');
}

function hasActiveLease(row: LiveDraftQueueStateRow, now: Date): boolean {
  return [
    row.processingLeaseExpiresAt,
    row.leaseExpiresAt,
    row.lockedUntil,
  ].some((value) => {
    const timestamp = Date.parse(value ?? '');
    return Number.isFinite(timestamp) && timestamp > now.getTime();
  });
}

/**
 * Waiting queue entries are documented but do not block draft staging.
 * Active processing or an unexpired worker/scheduler lease does block.
 * The supplied rows are treated as immutable observations.
 */
export function assessLiveDraftQueuePreflight(
  input: LiveDraftQueuePreflightInput,
): LiveDraftQueuePreflightResult {
  const queuedIds = input.queueRows
    .filter((row) => row.status?.trim().toLowerCase() === 'queued')
    .map((row) => row.id)
    .sort();
  const blockers: LiveDraftQueuePreflightResult['blockers'] = [];

  for (const [kind, rows] of [
    ['queue', input.queueRows],
    ['import_job', input.importJobs],
    ['worker_run', input.workerRuns],
    ['scheduler_run', input.schedulerRuns],
    ['schedule_lock', input.scheduleLocks],
  ] as const) {
    for (const row of rows) {
      if (hasActiveStatus(row)) {
        blockers.push({ kind, id: row.id, reason: `active_status:${row.status}` });
      } else if (hasActiveLease(row, input.now)) {
        blockers.push({ kind, id: row.id, reason: 'active_lease' });
      }
    }
  }

  return {
    allowed: blockers.length === 0,
    queuedIds,
    blockers,
  };
}
