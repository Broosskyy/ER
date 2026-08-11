import { describe, expect, it } from 'vitest';

import {
  assessLiveDraftQueuePreflight,
  type LiveDraftQueuePreflightInput,
} from '../live-draft-staging-preflight';

const NOW = new Date('2026-08-11T20:00:00.000Z');

function input(
  overrides: Partial<LiveDraftQueuePreflightInput> = {},
): LiveDraftQueuePreflightInput {
  return {
    queueRows: [],
    importJobs: [],
    workerRuns: [],
    schedulerRuns: [],
    scheduleLocks: [],
    now: NOW,
    ...overrides,
  };
}

describe('queue-aware live draft staging preflight', () => {
  it('allows waiting queued jobs', () => {
    const result = assessLiveDraftQueuePreflight(
      input({
        queueRows: [
          { id: 'queue-a', status: 'queued' },
          { id: 'queue-b', status: 'queued' },
        ],
      }),
    );

    expect(result).toEqual({
      allowed: true,
      queuedIds: ['queue-a', 'queue-b'],
      blockers: [],
    });
  });

  it('blocks running work and active leases', () => {
    const result = assessLiveDraftQueuePreflight(
      input({
        importJobs: [{ id: 'job-running', status: 'running' }],
        workerRuns: [
          {
            id: 'worker-leased',
            status: 'completed',
            leaseExpiresAt: '2026-08-11T20:05:00.000Z',
          },
        ],
      }),
    );

    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual([
      {
        kind: 'import_job',
        id: 'job-running',
        reason: 'active_status:running',
      },
      {
        kind: 'worker_run',
        id: 'worker-leased',
        reason: 'active_lease',
      },
    ]);
  });

  it('does not mutate observed queue rows', () => {
    const queueRows = [
      {
        id: 'queue-a',
        status: 'queued',
        processingLeaseExpiresAt: null,
      },
    ];
    const before = structuredClone(queueRows);

    assessLiveDraftQueuePreflight(input({ queueRows }));

    expect(queueRows).toEqual(before);
  });
});
