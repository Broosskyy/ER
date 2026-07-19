export const NOTIFICATION_TYPES = [
  'event_new',
  'event_updated',
  'event_cancelled',
  'event_upcoming',
  'ticket_info',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
