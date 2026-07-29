import { describe, expect, it } from 'vitest';

import { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import { InMemoryImportJobQueueRepository } from '@/features/import/scheduling/in-memory-scheduler-repositories';

function createQueueEntry(id: string, scheduledFor: string) {
  return {
    id,
    sourceId: 'source-bootshaus-koeln',
    importJobId: `job-${id}`,
    priority: 50,
    status: 'queued' as const,
    scheduledFor,
    enqueuedAt: scheduledFor,
    triggerType: 'scheduled' as const,
    attemptCount: 0,
    maxAttempts: 3,
  };
}

describe('Sprint 26.6 — atomic queue claim', () => {
  it('claims queued entries atomically with worker and lease metadata', async () => {
    const repository = new InMemoryImportJobQueueRepository();
    const service = new ImportJobQueueService(repository);
    const now = new Date('2026-07-15T10:00:00.000Z');

    await repository.enqueue(createQueueEntry('queue-1', '2026-07-15T09:00:00.000Z'));
    await repository.enqueue(createQueueEntry('queue-2', '2026-07-15T09:30:00.000Z'));

    const claimed = await service.claimReadyJobs(2, now, 'worker-a');
    expect(claimed).toHaveLength(2);
    expect(claimed[0]?.status).toBe('processing');
    expect(claimed[0]?.workerId).toBe('worker-a');
    expect(claimed[0]?.processingStartedAt).toBeTruthy();
    expect(claimed[0]?.processingLeaseExpiresAt).toBeTruthy();
  });

  it('does not double-claim the same entry across workers', async () => {
    const repository = new InMemoryImportJobQueueRepository();
    const service = new ImportJobQueueService(repository);
    const now = new Date('2026-07-15T10:00:00.000Z');

    await repository.enqueue(createQueueEntry('queue-1', '2026-07-15T09:00:00.000Z'));

    const firstClaim = await service.claimReadyJobs(1, now, 'worker-a');
    const secondClaim = await service.claimReadyJobs(1, now, 'worker-b');

    expect(firstClaim).toHaveLength(1);
    expect(secondClaim).toHaveLength(0);
  });

  it('skips future-scheduled entries during claim', async () => {
    const repository = new InMemoryImportJobQueueRepository();
    const service = new ImportJobQueueService(repository);
    const now = new Date('2026-07-15T10:00:00.000Z');

    await repository.enqueue(createQueueEntry('queue-future', '2026-07-15T11:00:00.000Z'));

    const claimed = await service.claimReadyJobs(5, now, 'worker-a');
    expect(claimed).toHaveLength(0);
  });

  it('clears worker metadata when requeued for retry', async () => {
    const repository = new InMemoryImportJobQueueRepository();
    const service = new ImportJobQueueService(repository);
    const now = new Date('2026-07-15T10:00:00.000Z');

    await repository.enqueue(createQueueEntry('queue-1', '2026-07-15T09:00:00.000Z'));
    const [claimed] = await service.claimReadyJobs(1, now, 'worker-a');
    expect(claimed).toBeDefined();

    const requeued = await service.requeueForRetry(
      claimed!,
      '2026-07-15T10:05:00.000Z',
      1,
    );
    expect(requeued.status).toBe('queued');
    expect(requeued.workerId).toBeUndefined();
    expect(requeued.processingStartedAt).toBeUndefined();
    expect(requeued.processingLeaseExpiresAt).toBeUndefined();
  });
});
