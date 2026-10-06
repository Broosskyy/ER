import { describe, expect, it } from 'vitest';

import {
  auditReferenceInstant,
  berlinLocalMidnightUtcMs,
  classifyConsumerEventLifecycle,
  isPastConsumerEvent,
  m9_2_2CleanupReferenceInstant,
} from '../consumer-event-cutoff';

describe('consumer-event-cutoff', () => {
  const cleanupReference = m9_2_2CleanupReferenceInstant();
  const auditReference = auditReferenceInstant();

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

  it('marks events before 2026-09-01 Berlin as past on audit date', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-31T18:00:00.000Z',
        referenceInstant: auditReference,
      }),
    ).toBe(true);
  });

  it('keeps events later on 2026-09-01 Berlin upcoming', () => {
    expect(
      classifyConsumerEventLifecycle({
        startsAt: '2026-09-01T20:00:00.000Z',
        referenceInstant: auditReference,
      }),
    ).toBe('UPCOMING');
  });

  it('keeps multi-day events ongoing until endsAt on audit date', () => {
    expect(
      classifyConsumerEventLifecycle({
        startsAt: '2026-08-31T18:00:00.000Z',
        endsAt: '2026-09-02T04:00:00.000Z',
        referenceInstant: auditReference,
      }),
    ).toBe('ONGOING');
  });

  it('marks multi-day events ended when endsAt is before audit day', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-30T18:00:00.000Z',
        endsAt: '2026-08-31T04:00:00.000Z',
        referenceInstant: auditReference,
      }),
    ).toBe(true);
  });

  it('marks events whose endsAt is before audit day start as past on 2026-09-01', () => {
    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-30T18:00:00.000Z',
        endsAt: '2026-08-31T21:59:00.000Z',
        referenceInstant: auditReference,
      }),
    ).toBe(true);
  });
});
