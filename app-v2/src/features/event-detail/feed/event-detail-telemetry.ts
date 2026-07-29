export type EventDetailTelemetryEventName =
  | 'detail_load_start'
  | 'detail_load_complete'
  | 'detail_load_error'
  | 'detail_opened'
  | 'detail_ticket_cta'
  | 'detail_favorite_set'
  | 'detail_favorite_remove'
  | 'detail_share'
  | 'detail_similar_opened'
  | 'detail_retry';

export interface EventDetailTelemetryEvent {
  name: EventDetailTelemetryEventName;
  eventId?: string;
  durationMs?: number;
  error?: string;
  timestamp: string;
}

type EventDetailTelemetryListener = (event: EventDetailTelemetryEvent) => void;

const listeners = new Set<EventDetailTelemetryListener>();
const recentEvents: EventDetailTelemetryEvent[] = [];
const MAX_RECENT_EVENTS = 100;

export function trackEventDetailTelemetry(
  name: EventDetailTelemetryEventName,
  payload: Omit<EventDetailTelemetryEvent, 'name' | 'timestamp'> = {},
): void {
  const event: EventDetailTelemetryEvent = {
    name,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  for (const listener of listeners) {
    listener(event);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.debug('[EventDetailTelemetry]', event);
  }
}

export function getRecentEventDetailTelemetry(): readonly EventDetailTelemetryEvent[] {
  return recentEvents;
}

export function resetEventDetailTelemetryForTests(): void {
  listeners.clear();
  recentEvents.length = 0;
}
