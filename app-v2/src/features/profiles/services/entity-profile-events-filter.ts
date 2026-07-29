import { eventRepository } from '@/data/repositories/registry';
import { eventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import { toEventLifecycleInput } from '@/features/events/lifecycle/event-lifecycle-from-event';
import type { Event } from '@/features/events/types/event';

export function dedupeProfileEvents(events: Event[]): Event[] {
  const seen = new Set<string>();
  const result: Event[] = [];

  for (const event of events) {
    const canonicalId = eventRepository.resolveCanonicalId(event.canonicalEventId ?? event.id);
    if (seen.has(canonicalId)) {
      continue;
    }
    seen.add(canonicalId);
    result.push({ ...event, id: canonicalId });
  }

  return result;
}

export function filterProfileEvents(events: Event[]): Event[] {
  return dedupeProfileEvents(events).filter((event) => {
    if (event.status === 'archived') {
      return false;
    }
    const lifecycle = eventLifecycleResolver.resolve(toEventLifecycleInput(event));
    return lifecycle.status !== 'archived';
  });
}
