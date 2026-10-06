import type { EventDisplayModel } from '@/features/events';

export type SavedEventSource = 'home' | 'events' | 'map' | 'detail' | 'saved' | 'unknown';

export interface SavedEventRecord {
  eventId: string;
  savedAt: string;
  source?: SavedEventSource;
  notificationPreference?: 'default' | 'muted';
}

export interface SavedEvent extends SavedEventRecord {
  event: EventDisplayModel;
  unavailable?: boolean;
}

export type SavedFilterId = 'all' | 'upcoming' | 'past' | 'cancelled';
