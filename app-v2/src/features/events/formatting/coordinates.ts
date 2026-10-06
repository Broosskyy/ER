import type { Event } from '@/features/events/types/event';

export function hasValidCoordinates(
  event: Pick<Event, 'latitude' | 'longitude'>,
): event is Event & { latitude: number; longitude: number } {
  return typeof event.latitude === 'number' && typeof event.longitude === 'number';
}
