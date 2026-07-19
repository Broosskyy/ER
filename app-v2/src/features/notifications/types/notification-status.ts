export const NOTIFICATION_STATUSES = ['unread', 'read'] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export function isNotificationStatus(value: string): value is NotificationStatus {
  return (NOTIFICATION_STATUSES as readonly string[]).includes(value);
}
