import type { EventStatus } from '@/features/events/types/event-status';

export interface EventSnapshotEntry {
  id: string;
  title: string;
  startDateTime: string;
  venue: string;
  status: EventStatus;
  priceText?: string;
  ticketUrl?: string;
  updatedAt: string;
}

export interface EventSnapshot {
  version: 1;
  capturedAt: string;
  events: Record<string, EventSnapshotEntry>;
}
