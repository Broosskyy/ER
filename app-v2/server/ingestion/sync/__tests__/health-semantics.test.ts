import { describe, expect, it } from 'vitest';

import {
  createInitialSourceHealth,
  isContentReviewOnlyRun,
  resolveHealthStatus,
  updateSourceHealth,
} from '../health';
import { createEmptySyncRunCounters } from '../types';

describe('M8.7 technical health vs content review', () => {
  it('keeps source healthy when only content review events exist', () => {
    const counters = createEmptySyncRunCounters();
    counters.planned = 7;
    counters.parsed = 7;
    counters.reviewRequired = 1;
    counters.newEvents = 6;

    expect(
      isContentReviewOnlyRun('partially_succeeded', counters, ['reconciliation_review']),
    ).toBe(true);

    const health = updateSourceHealth({
      connectorId: 'affenkaefig-official',
      enabled: true,
      run: {
        status: 'partially_succeeded',
        counters,
        errorCategories: ['reconciliation_review'],
      },
    });

    expect(health.healthStatus).toBe('healthy');
    expect(health.contentReviewCount).toBe(1);
    expect(health.consecutiveFailures).toBe(0);
    expect(health.lastFailureAt).toBeUndefined();
  });

  it('marks degraded when technical partial failures remain', () => {
    const counters = createEmptySyncRunCounters();
    counters.planned = 2;
    counters.failures = 1;
    counters.parsed = 2;

    const status = resolveHealthStatus(true, 'partially_succeeded', 0, false, counters, ['parser_degraded']);
    expect(status).toBe('degraded');
  });

  it('marks failing after repeated hard failures', () => {
    const previous = createInitialSourceHealth('bootshaus-official', true);
    previous.consecutiveFailures = 2;

    const counters = createEmptySyncRunCounters();
    const health = updateSourceHealth({
      connectorId: 'bootshaus-official',
      enabled: true,
      previousHealth: previous,
      run: {
        status: 'failed',
        counters,
        errorCategories: ['network_timeout'],
      },
    });

    expect(health.healthStatus).toBe('failing');
    expect(health.consecutiveFailures).toBe(3);
  });
});
