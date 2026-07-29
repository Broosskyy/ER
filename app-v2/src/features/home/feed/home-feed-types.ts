import type { DiscoveryCursor } from '@/features/discovery/domain/discovery-pagination-types';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { CollectionType } from '@/features/collections/event-collection-config';

export type HomeFeedSectionPreset =
  | 'trending'
  | 'today'
  | 'weekend'
  | 'this-week'
  | 'next-week'
  | 'nearby'
  | 'newly-added'
  | 'upcoming-highlights'
  | 'genre';

export type HomeFeedSectionLayout = 'rail' | 'list';

export interface HomeFeedSectionDefinition {
  id: string;
  preset: HomeFeedSectionPreset;
  title: string;
  layout: HomeFeedSectionLayout;
  previewLimit: number;
  collectionType?: CollectionType;
  genreLabel?: string;
  requiresLocation?: boolean;
  showOnHome: boolean;
  emptyTitle: string;
  emptyDescription: string;
}

export interface HomeFeedLocationContext {
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface HomeFeedSectionState {
  id: string;
  events: EventDisplayModel[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor?: DiscoveryCursor;
  totalMatched: number;
}

export interface HomeFeedLoadResult {
  events: EventDisplayModel[];
  hasMore: boolean;
  cursor?: DiscoveryCursor;
  totalMatched: number;
  durationMs: number;
}
