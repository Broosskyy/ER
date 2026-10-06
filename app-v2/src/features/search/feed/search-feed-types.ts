import type { DiscoveryCursor } from '@/features/discovery/domain/discovery-pagination-types';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface DiscoverySearchLocationContext {
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface DiscoverySearchLoadResult {
  events: EventDisplayModel[];
  hasMore: boolean;
  cursor?: DiscoveryCursor;
  totalMatched: number;
  durationMs: number;
}

export interface DiscoverySearchSuggestion {
  id: string;
  kind: 'event' | 'city' | 'genre' | 'query';
  title: string;
  subtitle?: string;
  query: string;
}

export interface DiscoverySearchLoadOptions {
  limit?: number;
  cursor?: DiscoveryCursor;
  bypassCache?: boolean;
  location?: DiscoverySearchLocationContext;
}
