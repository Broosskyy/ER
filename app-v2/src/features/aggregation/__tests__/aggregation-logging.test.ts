import { describe, expect, it } from 'vitest';

import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';

describe('aggregation logging', () => {
  it('records start, step and finish entries with duration and counts', async () => {
    const logger = new AggregationLogService();
    const run = await logger.startRun({
      runId: 'run-1',
      sourceId: 'source-1',
      sourceName: 'Club Website',
      triggerType: 'manual',
    });

    await logger.logStep('run-1', 'source-1', 'fetch', 120, {
      events: 3,
      warnings: 1,
      errors: 0,
    });

    const finished = await logger.finishRun(run, {
      durationMs: 500,
      eventCount: 3,
      errorCount: 0,
      warningCount: 1,
      stepDurations: { fetch: 120 },
    });

    expect(finished.durationMs).toBe(500);
    expect(finished.eventCount).toBe(3);
    expect(logger.listEntries('run-1').some((entry) => entry.code === 'AGGREGATION_RUN_START')).toBe(
      true,
    );
    expect(logger.listEntries('run-1').some((entry) => entry.code === 'AGGREGATION_RUN_FINISH')).toBe(
      true,
    );
  });
});
