export const EVENT_STATUSES = [
  'imported',
  'needs_review',
  'published',
  'rejected',
  'cancelled',
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}

export function isPublishedStatus(status: EventStatus): boolean {
  return status === 'published';
}
