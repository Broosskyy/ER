import { describe, expect, it } from 'vitest';

import {
  DefaultImportScheduleService,
  InMemoryImportScheduleRepository,
} from '@/features/import/scheduling/import-schedule-service';

describe('scale scheduler sources', () => {
  it('finds due work across 1,000 configured sources', async () => {
    const repository = new InMemoryImportScheduleRepository();
    const now = new Date('2026-08-01T10:00:00.000Z');

    for (let index = 0; index < 1_000; index += 1) {
      await repository.saveState({
        sourceId: `source-${index}`,
        scheduleEnabled: true,
        schedulePolicy: 'interval',
        pollingIntervalMinutes: 60,
        nextScheduledAt:
          index % 2 === 0
            ? '2026-08-01T09:00:00.000Z'
            : '2026-08-01T11:00:00.000Z',
        consecutiveFailures: 0,
      });
    }

    const startedAt = performance.now();
    const due = await new DefaultImportScheduleService(repository).listDueSources(now);
    const durationMs = performance.now() - startedAt;

    expect(due).toHaveLength(500);
    expect(durationMs).toBeLessThan(200);
  });
});
