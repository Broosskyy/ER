import { describe, expect, it } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { EventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import type { EventLifecycleInput } from '@/features/events/lifecycle/lifecycle-types';

function baseInput(overrides: Partial<EventLifecycleInput> = {}): EventLifecycleInput {
  return {
    editorialStatus: 'published',
    timezone: 'Europe/Berlin',
    startAt: '2026-08-01T20:00:00.000Z',
    publishedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('EventLifecycleResolver', () => {
  const resolver = new EventLifecycleResolver(new FixedClock(new Date('2026-07-15T12:00:00.000Z')));

  it('returns scheduled for future events', () => {
    const result = resolver.resolve(baseInput());
    expect(result.status).toBe('scheduled');
  });

  it('returns happening_now between start and end', () => {
    const result = resolver.resolve(
      baseInput({
        startAt: '2026-07-15T10:00:00.000Z',
        endAt: '2026-07-15T14:00:00.000Z',
      }),
    );
    expect(result.status).toBe('happening_now');
  });

  it('returns ended after event end', () => {
    const result = resolver.resolve(
      baseInput({
        startAt: '2026-07-14T20:00:00.000Z',
        endAt: '2026-07-14T23:00:00.000Z',
      }),
    );
    expect(result.status).toBe('ended');
  });

  it('prioritizes cancelled over time-based status', () => {
    const result = resolver.resolve(
      baseInput({
        startAt: '2026-07-15T10:00:00.000Z',
        endAt: '2026-07-15T14:00:00.000Z',
        cancelledAt: '2026-07-14T12:00:00.000Z',
      }),
    );
    expect(result.status).toBe('cancelled');
  });

  it('prioritizes postponed over time-based status', () => {
    const result = resolver.resolve(
      baseInput({
        postponedAt: '2026-07-14T12:00:00.000Z',
      }),
    );
    expect(result.status).toBe('postponed');
  });

  it('derives endAt with default duration when missing', () => {
    const result = resolver.resolve(
      baseInput({
        startAt: '2026-07-14T20:00:00.000Z',
      }),
      new Date('2026-07-15T12:00:00.000Z'),
    );
    expect(result.status).toBe('ended');
    expect(result.effectiveEndAt).toBe('2026-07-15T00:00:00.000Z');
  });

  it('handles timezone-aware instants deterministically', () => {
    const berlinResolver = new EventLifecycleResolver(new FixedClock(new Date('2026-03-29T22:30:00.000Z')));
    const result = berlinResolver.resolve(
      baseInput({
        timezone: 'Europe/Berlin',
        startAt: '2026-03-29T21:00:00.000Z',
        endAt: '2026-03-29T23:00:00.000Z',
      }),
    );
    expect(result.status).toBe('happening_now');
  });

  it('returns on_sale during sales window', () => {
    const result = resolver.resolve(
      baseInput({
        salesStartAt: '2026-07-01T00:00:00.000Z',
        salesEndAt: '2026-08-01T00:00:00.000Z',
        ticketStatus: 'on_sale',
      }),
    );
    expect(result.status).toBe('on_sale');
  });

  it('exposes discoverable only for active upcoming states', () => {
    expect(resolver.isDiscoverable(baseInput())).toBe(true);
    expect(
      resolver.isDiscoverable(
        baseInput({
          startAt: '2026-07-14T20:00:00.000Z',
          endAt: '2026-07-14T23:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });
});
