import type { NotificationType } from '../types/notification-type';

export interface DeduplicationKeyInput {
  eventId?: string | null;
  type: NotificationType;
  version?: string;
}

export function buildDeduplicationKey(input: DeduplicationKeyInput): string {
  const eventPart = input.eventId ?? 'general';
  const versionPart = input.version ?? 'v1';
  return `${eventPart}:${input.type}:${versionPart}`;
}
