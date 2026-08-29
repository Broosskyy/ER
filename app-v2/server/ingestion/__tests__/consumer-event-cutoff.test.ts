import { describe, expect, it } from 'vitest';

import {
  berlinLocalMidnightUtcMs,
  isPastConsumerEvent,
  m9_2_2CleanupReferenceInstant,
} from '../consumer-event-cutoff';

describe('consumer-event-cutoff', () => {
  const cleanupReference = m9_2_2CleanupReferenceInstant();

  it('treats events through 2026-08-28 Berlin as past', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-28T20:00:00.000Z',
        referenceInstant: cleanupReference,
      }),
    ).toBe(true);
  });

  it('keeps events from 2026-08-29 Berlin active', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-28T22:00:00.000Z',
        referenceInstant: cleanupReference,
      }),
    ).toBe(false);
  });

  it('keeps multi-day events active when endsAt is on or after cutoff', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-28T18:00:00.000Z',
        endsAt: '2026-08-30T04:00:00.000Z',
        referenceInstant: cleanupReference,
      }),
    ).toBe(false);
  });

  it('marks multi-day events past when endsAt is before cutoff day', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-26T18:00:00.000Z',
        endsAt: '2026-08-28T04:00:00.000Z',
        referenceInstant: cleanupReference,
      }),
    ).toBe(true);
  });

  it('resolves Berlin midnight for active-from date', () => {
    const activeFromMs = berlinLocalMidnightUtcMs('2026-08-29');
    expect(new Date(activeFromMs).toISOString()).toBe('2026-08-28T22:00:00.000Z');
  });
});
