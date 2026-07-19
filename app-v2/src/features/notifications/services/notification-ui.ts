import type { Ionicons } from '@expo/vector-icons';

import type { NotificationType } from '../types/notification-type';
import { formatNotificationTimestamp as formatTimestamp } from './notification-grouping';

export function getNotificationIconName(
  type: NotificationType,
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'event_new':
      return 'sparkles-outline';
    case 'event_updated':
      return 'create-outline';
    case 'event_cancelled':
      return 'close-circle-outline';
    case 'event_upcoming':
      return 'time-outline';
    case 'ticket_info':
      return 'ticket-outline';
    default:
      return 'notifications-outline';
  }
}

export function formatNotificationTimestamp(
  createdAt: string,
  referenceDate: Date = new Date(),
): string {
  return formatTimestamp(createdAt, referenceDate);
}
