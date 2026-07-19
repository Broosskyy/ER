export const NOTIFICATION_TYPES = [
  'new_event',
  'saved_event_updated',
  'saved_event_cancelled',
  'saved_event_starting_soon',
  'ticket_available',
  'general',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
