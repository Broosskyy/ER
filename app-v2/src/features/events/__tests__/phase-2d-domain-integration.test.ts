import { describe, expect, it } from 'vitest';

import { FixedClock } from '@/core/clock/fixed-clock';
import { groupEventsByProfileBucket } from '@/features/events/domain/entity-profile-events-service';
import {
  InMemoryRealDataDomainEventBus,
  publishLifecycleDomainEvent,
} from '@/features/events/domain/real-data-domain-events';
import { EventRepository } from '@/data/repositories/repositories';
import { EventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import { toEventLifecycleInput } from '@/features/events/lifecycle/event-lifecycle-from-event';
import type { Event } from '@/features/events/types/event';
import { FollowService, InMemoryFollowStorage } from '@/features/follows/follow-service';
import { buildSourceTrustMetrics } from '@/features/sources/domain/source-trust-metrics';
import { buildEventSearchIndex } from '@/features/search/constants';

const baseEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'evt-1',
  slug: 'evt-1',
  title: 'Techno Night',
  description: 'Desc',
  startDateTime: '2026-08-01T20:00:00.000Z',
  endDateTime: '2026-08-02T04:00:00.000Z',
  timezone: 'Europe/Berlin',
  venue: 'Bootshaus',
  city: 'Köln',
  country: 'Germany',
  genres: ['Techno'],
  artists: ['Ben Klock'],
  organizer: 'Boiler Room',
  venueId: 'venue-1',
  organizerId: 'org-1',
  artistIds: ['artist-1'],
  source: 'source-a',
  sourceEventId: 'evt-1',
  status: 'published',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

describe('Phase 2D domain integration', () => {
  it('resolves lifecycle cancelled and postponed with priority', () => {
    const resolver = new EventLifecycleResolver(new FixedClock(new Date('2026-07-15T12:00:00.000Z')));
    expect(
      resolver.resolve(
        toEventLifecycleInput(
          baseEvent({
            cancelledAt: '2026-07-14T12:00:00.000Z',
            startDateTime: '2026-07-15T10:00:00.000Z',
            endDateTime: '2026-07-15T14:00:00.000Z',
          }),
        ),
      ).status,
    ).toBe('cancelled');
    expect(
      resolver.resolve(
        toEventLifecycleInput(
          baseEvent({
            postponedAt: '2026-07-14T12:00:00.000Z',
          }),
        ),
      ).status,
    ).toBe('postponed');
  });

  it('maps rejected editorial status to archived lifecycle', () => {
    const resolver = new EventLifecycleResolver(new FixedClock(new Date('2026-07-15T12:00:00.000Z')));
    expect(
      resolver.resolve(toEventLifecycleInput(baseEvent({ status: 'rejected' }))).status,
    ).toBe('archived');
  });

  it('groups organizer/venue/artist linked events into profile buckets', () => {
    const clock = new FixedClock(new Date('2026-07-15T12:00:00.000Z'));
    const grouped = groupEventsByProfileBucket(
      [
        baseEvent({ id: 'upcoming', startDateTime: '2026-08-01T20:00:00.000Z' }),
        baseEvent({
          id: 'live',
          startDateTime: '2026-07-15T10:00:00.000Z',
          endDateTime: '2026-07-15T14:00:00.000Z',
        }),
        baseEvent({
          id: 'past',
          startDateTime: '2026-07-10T20:00:00.000Z',
          endDateTime: '2026-07-11T00:00:00.000Z',
        }),
      ],
      clock,
    );
    expect(grouped.upcoming.map((event) => event.id)).toEqual(['upcoming']);
    expect(grouped.happeningNow.map((event) => event.id)).toEqual(['live']);
    expect(grouped.past.map((event) => event.id)).toEqual(['past']);
  });

  it('excludes ended and archived events from discovery', () => {
    const clock = new FixedClock(new Date('2026-12-01T12:00:00.000Z'));
    const repository = new EventRepository();
    repository.initializeSync([
      baseEvent({ id: 'future', startDateTime: '2027-01-01T20:00:00.000Z', endDateTime: '2027-01-02T04:00:00.000Z' }),
      baseEvent({
        id: 'ended',
        startDateTime: '2026-08-01T20:00:00.000Z',
        endDateTime: '2026-08-02T04:00:00.000Z',
      }),
      baseEvent({
        id: 'archived-editorial',
        status: 'archived',
        startDateTime: '2027-02-01T20:00:00.000Z',
      }),
    ]);

    expect(repository.getPublishedEvents()).toHaveLength(3);
    const resolver = new EventLifecycleResolver(clock);
    expect(
      resolver.isDiscoverable(
        toEventLifecycleInput(
          baseEvent({
            id: 'future',
            startDateTime: '2027-01-01T20:00:00.000Z',
            endDateTime: '2027-01-02T04:00:00.000Z',
          }),
        ),
        clock.now(),
      ),
    ).toBe(true);
    expect(
      resolver.isDiscoverable(
        toEventLifecycleInput(
          baseEvent({
            id: 'ended',
            startDateTime: '2026-08-01T20:00:00.000Z',
            endDateTime: '2026-08-02T04:00:00.000Z',
          }),
        ),
        clock.now(),
      ),
    ).toBe(false);

    const discoverable = repository.getPublishedEvents().filter((event) =>
      resolver.isDiscoverable(toEventLifecycleInput(event), clock.now()),
    );
    expect(discoverable.map((event) => event.id)).toEqual(['future']);
  });

  it('indexes organizer, venue and artist names in unified search index', () => {
    const index = buildEventSearchIndex(baseEvent());
    expect(index).toContain('boiler room');
    expect(index).toContain('bootshaus');
    expect(index).toContain('ben klock');
  });

  it('stores follows by canonical entity id without duplicates', async () => {
    const service = new FollowService({ storage: new InMemoryFollowStorage() });
    await service.follow('organizer', 'org-1');
    await service.follow('organizer', 'org-1');
    await service.follow('venue', 'venue-1');
    expect(await service.isFollowing('organizer', 'org-1')).toBe(true);
    expect((await service.list('organizer')).map((entry) => entry.canonicalEntityId)).toEqual([
      'org-1',
    ]);
  });

  it('prepares source trust metrics without auto scoring', () => {
    const metrics = buildSourceTrustMetrics({
      trustScore: 80,
      consecutiveFailures: 2,
      totalImportCount: 10,
      totalValidEventCount: 8,
      duplicateRate: 0.1,
      updateRate: 0.2,
      errorRate: 0.05,
    });
    expect(metrics.trustScore).toBe(80);
    expect(metrics.importSuccessRate).toBe(0.8);
    expect(metrics.consecutiveFailures).toBe(2);
  });

  it('publishes domain events for notification preparation', () => {
    const bus = new InMemoryRealDataDomainEventBus();
    publishLifecycleDomainEvent(bus, {
      type: 'event_cancelled',
      canonicalEventId: 'evt-1',
      sourceId: 'source-a',
    });
    expect(bus.listByType('event_cancelled')).toHaveLength(1);
  });
});
