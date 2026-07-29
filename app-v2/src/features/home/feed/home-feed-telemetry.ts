export type HomeFeedTelemetryEventName =
  | 'feed_load_start'
  | 'feed_load_complete'
  | 'feed_refresh_start'
  | 'feed_refresh_complete'
  | 'section_load_start'
  | 'section_load_complete'
  | 'section_load_error'
  | 'section_pagination';

export interface HomeFeedTelemetryEvent {
  name: HomeFeedTelemetryEventName;
  sectionId?: string;
  durationMs?: number;
  itemCount?: number;
  error?: string;
  timestamp: string;
}

type HomeFeedTelemetryListener = (event: HomeFeedTelemetryEvent) => void;

const listeners = new Set<HomeFeedTelemetryListener>();
const recentEvents: HomeFeedTelemetryEvent[] = [];
const MAX_RECENT_EVENTS = 100;

export function trackHomeFeedTelemetry(
  name: HomeFeedTelemetryEventName,
  payload: Omit<HomeFeedTelemetryEvent, 'name' | 'timestamp'> = {},
): void {
  const event: HomeFeedTelemetryEvent = {
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
    // Internal diagnostics only — no external analytics provider.
    console.debug('[HomeFeedTelemetry]', event);
  }
}

export function subscribeHomeFeedTelemetry(listener: HomeFeedTelemetryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentHomeFeedTelemetry(): readonly HomeFeedTelemetryEvent[] {
  return recentEvents;
}

export function resetHomeFeedTelemetryForTests(): void {
  listeners.clear();
  recentEvents.length = 0;
}
