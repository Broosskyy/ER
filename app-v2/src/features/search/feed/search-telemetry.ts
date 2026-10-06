export type SearchTelemetryEventName =
  | 'search_start'
  | 'search_complete'
  | 'search_error'
  | 'search_abandon'
  | 'search_suggestions'
  | 'search_filter_apply'
  | 'search_pagination';

export interface SearchTelemetryEvent {
  name: SearchTelemetryEventName;
  query?: string;
  filterCount?: number;
  durationMs?: number;
  resultCount?: number;
  error?: string;
  timestamp: string;
}

type SearchTelemetryListener = (event: SearchTelemetryEvent) => void;

const listeners = new Set<SearchTelemetryListener>();
const recentEvents: SearchTelemetryEvent[] = [];
const MAX_RECENT_EVENTS = 100;

export function trackSearchTelemetry(
  name: SearchTelemetryEventName,
  payload: Omit<SearchTelemetryEvent, 'name' | 'timestamp'> = {},
): void {
  const event: SearchTelemetryEvent = {
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
    console.debug('[SearchTelemetry]', event);
  }
}

export function subscribeSearchTelemetry(listener: SearchTelemetryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentSearchTelemetry(): readonly SearchTelemetryEvent[] {
  return recentEvents;
}

export function resetSearchTelemetryForTests(): void {
  listeners.clear();
  recentEvents.length = 0;
}
