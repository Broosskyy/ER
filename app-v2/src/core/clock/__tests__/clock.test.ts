import { describe, expect, it } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { systemClock } from '@/core/clock/system-clock';

describe('clock abstraction', () => {
  it('uses system clock in production', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('uses fixed clock deterministically in tests', () => {
    const clock = new FixedClock(new Date('2026-07-15T18:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2026-07-15T18:00:00.000Z');
  });
});
