import type { Event } from '@/features/events/types/event';

export function isInternalPublicEvent(_event: Event): boolean {
  return false;
}
