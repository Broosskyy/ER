import type { Clock } from '@/core/clock/clock';
import { systemClock } from '@/core/clock/system-clock';
import { eventRepository } from '@/features/events/repository/event-repository';
import { eventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import { toEventLifecycleInput } from '@/features/events/lifecycle/event-lifecycle-from-event';
import type { LifecycleStatus } from '@/features/events/lifecycle/lifecycle-types';
import type { Event } from '@/features/events/types/event';

export type EntityProfileEventBucket = 'upcoming' | 'happening_now' | 'past';

export interface EntityProfileEvents {
  upcoming: Event[];
  happeningNow: Event[];
  past: Event[];
}

function bucketForLifecycle(status: LifecycleStatus): EntityProfileEventBucket | null {
  if (status === 'happening_now') {
    return 'happening_now';
  }
  if (status === 'ended' || status === 'archived') {
    return 'past';
  }
  if (
    status === 'scheduled' ||
    status === 'on_sale' ||
    status === 'sold_out' ||
    status === 'postponed'
  ) {
    return 'upcoming';
  }
  return null;
}

export function groupEventsByProfileBucket(
  events: Event[],
  clock: Clock = systemClock,
): EntityProfileEvents {
  const now = clock.now();
  const result: EntityProfileEvents = {
    upcoming: [],
    happeningNow: [],
    past: [],
  };

  for (const event of events) {
    const lifecycle = eventLifecycleResolver.resolve(toEventLifecycleInput(event), now);
    const bucket = bucketForLifecycle(lifecycle.status);
    if (bucket === 'upcoming') {
      result.upcoming.push(event);
    } else if (bucket === 'happening_now') {
      result.happeningNow.push(event);
    } else if (bucket === 'past') {
      result.past.push(event);
    }
  }

  const byStart = (left: Event, right: Event) =>
    left.startDateTime.localeCompare(right.startDateTime);
  result.upcoming.sort(byStart);
  result.happeningNow.sort(byStart);
  result.past.sort((left, right) => right.startDateTime.localeCompare(left.startDateTime));

  return result;
}

export async function loadVenueProfileEvents(
  venueId: string,
  listEventIds: (venueId: string) => Promise<string[]>,
  clock: Clock = systemClock,
): Promise<EntityProfileEvents> {
  const eventIds = await listEventIds(venueId);
  const events = eventIds
    .map((eventId) => eventRepository.getEventById(eventId))
    .filter((event): event is Event => event !== undefined);
  return groupEventsByProfileBucket(events, clock);
}

export async function loadOrganizerProfileEvents(
  organizerId: string,
  listEventIds: (organizerId: string) => Promise<string[]>,
  clock: Clock = systemClock,
): Promise<EntityProfileEvents> {
  const eventIds = await listEventIds(organizerId);
  const events = eventIds
    .map((eventId) => eventRepository.getEventById(eventId))
    .filter((event): event is Event => event !== undefined);
  return groupEventsByProfileBucket(events, clock);
}

export async function loadArtistProfileEvents(
  artistId: string,
  listEventIds: (artistId: string) => Promise<string[]>,
  clock: Clock = systemClock,
): Promise<EntityProfileEvents> {
  const eventIds = await listEventIds(artistId);
  const events = eventIds
    .map((eventId) => eventRepository.getEventById(eventId))
    .filter((event): event is Event => event !== undefined);
  return groupEventsByProfileBucket(events, clock);
}
