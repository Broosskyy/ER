import { describe, expect, it } from 'vitest';

import {
  CONSUMER_MISSING_END_MAX_DURATION_MS,
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
      }),
    ).toBe(false);
  });

  it('expires an event without endsAt after the bounded fallback duration', () => {
    const startsAt = '2026-10-16T22:00:00.000Z';
    const atBoundary = new Date(
      Date.parse(startsAt) + CONSUMER_MISSING_END_MAX_DURATION_MS,
    );

    expect(
      isPastConsumerEvent({
        startsAt,
        endsAt: null,
        referenceInstant: new Date(atBoundary.getTime() - 1),
      }),
    ).toBe(false);

    expect(
      isPastConsumerEvent({
        startsAt,
        endsAt: null,
        referenceInstant: atBoundary,
      }),
    ).toBe(true);
  });

  it('keeps future events discoverable when endsAt is missing', () => {
    const now = new Date('2026-10-17T19:30:00.000Z');

    expect(
      classifyConsumerEventLifecycle({
        startsAt: '2026-10-23T21:00:00.000Z',
        endsAt: null,
        status: 'published',
        referenceInstant: now,
      }),
    ).toBe('UPCOMING');
  });

  it('marks stale missing-end events as ended instead of ongoing', () => {
    const now = new Date('2026-10-17T19:30:00.000Z');

    expect(
      classifyConsumerEventLifecycle({
        startsAt: '2026-10-16T22:00:00.000Z',
        endsAt: null,
        status: 'published',
        referenceInstant: now,
      }),
    ).toBe('ENDED');
  });
});
