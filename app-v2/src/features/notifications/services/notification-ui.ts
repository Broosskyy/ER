import type { Ionicons } from '@expo/vector-icons';

import type { NotificationType } from '../types/notification-type';
import { formatRelativeNotificationTime } from './notification-time';

export function getNotificationIconName(
  type: NotificationType,
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'new_event':
      return 'sparkles-outline';
    case 'saved_event_updated':
      return 'create-outline';
    case 'saved_event_cancelled':
      return 'close-circle-outline';
    case 'saved_event_starting_soon':
      return 'time-outline';
    case 'ticket_available':
      return 'ticket-outline';
    case 'general':
      return 'notifications-outline';
    default:
      return 'notifications-outline';
  }
}

export function formatNotificationTimestamp(
  createdAt: string,
  referenceDate: Date = new Date(),
): string {
  return formatRelativeNotificationTime(createdAt, referenceDate);
}
