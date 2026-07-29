import type { Clock } from '@/core/clock/clock';
import { systemClock } from '@/core/clock/system-clock';
import type { EventRepository } from '@/data/repositories/repositories';
import { discoveryEligibilityResolver } from '@/features/events/discovery/discovery-eligibility-resolver';
import { toEventLifecycleInput } from '@/features/events/lifecycle/event-lifecycle-from-event';
import { eventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import type { Event } from '@/features/events/types/event';

let discoverableEventRepository: EventRepository | undefined;

export function bindDiscoverableEventRepository(repository: EventRepository): void {
  discoverableEventRepository = repository;
}

function getEventRepository(): EventRepository {
  if (!discoverableEventRepository) {
    throw new Error('Discoverable event repository is not initialized.');
  }
  return discoverableEventRepository;
}

export function getDiscoverablePublishedEvents(clock: Clock = systemClock): Event[] {
  const now = clock.now();
  return getEventRepository().getPublishedEvents().filter((event) => {
    const lifecycleInput = toEventLifecycleInput(event);
    const lifecycle = eventLifecycleResolver.resolve(lifecycleInput, now);
    const eligibility = discoveryEligibilityResolver.resolve(event, now);
    return (
      eligibility.eventsEligible &&
      lifecycle.status !== 'cancelled' &&
      lifecycle.status !== 'ended' &&
      lifecycle.status !== 'archived' &&
      lifecycle.status !== 'postponed'
    );
  });
}
