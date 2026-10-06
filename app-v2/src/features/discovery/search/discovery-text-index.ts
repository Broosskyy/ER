import type { Event } from '@/features/events/types/event';

export function buildDiscoveryTextIndex(event: {
  title: string;
  venue: string;
  city: string;
  genres: string[];
  artists: string[];
  organizer?: string;
  description?: string;
}): string {
  return [
    event.title,
    event.description,
    event.venue,
    event.city,
    event.organizer,
    ...event.genres,
    ...event.artists,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();
}

export function buildDiscoveryTextIndexFromEvent(event: Event): string {
  return buildDiscoveryTextIndex(event);
}
