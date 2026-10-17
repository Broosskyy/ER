import { describe, expect, it } from 'vitest';

import {
  CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
  classifyConsumerEventLifecycle,
  isPastConsumerEvent,
} from '../consumer-event-lifecycle';

describe('consumer event lifecycle', () => {
  it('honors a verified end time even for long-running events', () => {
    const now = new Date('2026-10-17T19:30:00.000Z');

    expect(
      isPastConsumerEvent({
        startsAt: '2026-10-16T20:00:00.000Z',
        endsAt: '2026-10-17T20:00:00.000Z',
        referenceInstant: now,
        missingEndMaxDurationMs: CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
      }),
    ).toBe(false);
  });

  it('expires a missing-end event after the discovery fallback duration', () => {
    const startsAt = '2026-10-16T22:00:00.000Z';
    const atBoundary = new Date(
      Date.parse(startsAt) + CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
    );

    expect(
      isPastConsumerEvent({
        startsAt,
        endsAt: null,
        referenceInstant: new Date(atBoundary.getTime() - 1),
        missingEndMaxDurationMs: CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
      }),
    ).toBe(false);

    expect(
      isPastConsumerEvent({
        startsAt,
        endsAt: null,
        referenceInstant: atBoundary,
        missingEndMaxDurationMs: CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
      }),
    ).toBe(true);
  });

  it('preserves the legacy Berlin-day cutoff when no duration bound is requested', () => {
    const referenceInstant = new Date('2026-09-01T10:00:00.000Z');

    expect(
      isPastConsumerEvent({
        startsAt: '2026-08-31T18:00:00.000Z',
        referenceInstant,
      }),
    ).toBe(true);
  });

  it('keeps future discovery events upcoming when endsAt is missing', () => {
    const now = new Date('2026-10-17T19:30:00.000Z');

    expect(
      classifyConsumerEventLifecycle({
        startsAt: '2026-10-23T21:00:00.000Z',
        endsAt: null,
        status: 'published',
        referenceInstant: now,
        missingEndMaxDurationMs: CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
      }),
    ).toBe('UPCOMING');
  });

  it('marks stale missing-end discovery events as ended', () => {
    const now = new Date('2026-10-17T19:30:00.000Z');

    expect(
      classifyConsumerEventLifecycle({
        startsAt: '2026-10-16T22:00:00.000Z',
        endsAt: null,
        status: 'published',
        referenceInstant: now,
        missingEndMaxDurationMs: CONSUMER_DISCOVERY_MISSING_END_MAX_DURATION_MS,
      }),
    ).toBe('ENDED');
  });
});
