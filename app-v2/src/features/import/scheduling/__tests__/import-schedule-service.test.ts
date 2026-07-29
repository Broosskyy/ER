import { describe, expect, it } from 'vitest';

import {
  DefaultImportScheduleService,
  InMemoryImportScheduleRepository,
} from '@/features/import/scheduling/import-schedule-service';
import type { ImportScheduleState } from '@/features/import/scheduling/import-schedule-types';

function state(overrides: Partial<ImportScheduleState> = {}): ImportScheduleState {
  return {
    sourceId: 'source-1',
    scheduleEnabled: true,
    schedulePolicy: 'interval',
    pollingIntervalMinutes: 60,
    timezone: 'Europe/Berlin',
    nextScheduledAt: '2026-07-15T10:00:00.000Z',
    consecutiveFailures: 0,
    ...overrides,
  };
}

describe('DefaultImportScheduleService', () => {
  it('lists due sources when nextScheduledAt is in the past', async () => {
    const repository = new InMemoryImportScheduleRepository();
    await repository.saveState(state());
    const service = new DefaultImportScheduleService(repository);

    const due = await service.listDueSources(new Date('2026-07-15T11:00:00.000Z'));
    expect(due).toHaveLength(1);
    expect(due[0]?.sourceId).toBe('source-1');
  });

  it('skips sources that are not yet due', async () => {
    const repository = new InMemoryImportScheduleRepository();
    await repository.saveState(state());
    const service = new DefaultImportScheduleService(repository);

    const due = await service.listDueSources(new Date('2026-07-15T09:00:00.000Z'));
    expect(due).toHaveLength(0);
  });

  it('skips disabled sources', async () => {
    const repository = new InMemoryImportScheduleRepository();
    await repository.saveState(state({ scheduleEnabled: false }));
    const service = new DefaultImportScheduleService(repository);

    const skip = service.shouldSkip(state({ scheduleEnabled: false }), new Date());
    expect(skip.skip).toBe(true);
    expect(skip.reason).toBe('disabled');
  });

  it('skips sources in backoff', async () => {
    const repository = new InMemoryImportScheduleRepository();
    const service = new DefaultImportScheduleService(repository);
    const skip = service.shouldSkip(
      state({ backoffUntil: '2026-07-15T12:00:00.000Z' }),
      new Date('2026-07-15T11:00:00.000Z'),
    );

    expect(skip.skip).toBe(true);
    expect(skip.reason).toBe('backoff_active');
  });

  it('computes next run after success', async () => {
    const repository = new InMemoryImportScheduleRepository();
    await repository.saveState(state());
    const service = new DefaultImportScheduleService(repository);

    const next = await service.recordSuccess('source-1', new Date('2026-07-15T11:00:00.000Z'));
    expect(next.consecutiveFailures).toBe(0);
    expect(next.nextScheduledAt).toBe('2026-07-15T12:00:00.000Z');
  });

  it('prevents parallel imports via lock lease', async () => {
    const repository = new InMemoryImportScheduleRepository();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const acquired = await repository.tryAcquireLock('source-1', 'lease-a', expiresAt);
    const blocked = await repository.tryAcquireLock('source-1', 'lease-b', expiresAt);

    expect(acquired).toBe(true);
    expect(blocked).toBe(false);
  });
});
