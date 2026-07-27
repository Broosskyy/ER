import type { EventCardViewModel, EventStatus } from '@/components/discovery/view-models';

export type SavedEventState = 'saved' | 'removed' | 'upcoming' | 'past' | 'cancelled';

export interface SavedEventViewModel extends EventCardViewModel {
  savedAtLabel?: string;
  savedState?: SavedEventState;
  collectionLabel?: string;
}

export interface SavedSectionViewModel {
  title: string;
  count?: number;
  sortLabel?: string;
  filterLabel?: string;
  editing?: boolean;
}

export type SavedFilterOption = 'all' | 'upcoming' | 'past' | 'cancelled';

export interface SavedFilterViewModel {
  id: SavedFilterOption;
  label: string;
  selected?: boolean;
  count?: number;
}

export type SavedSortOption = 'date' | 'saved_at' | 'distance';

export interface SavedSortViewModel {
  id: SavedSortOption;
  label: string;
  selected?: boolean;
}

export type SavedEmptyVariant =
  | 'no_saved'
  | 'no_filter_results'
  | 'no_past'
  | 'empty_collection';

export interface SavedEmptyViewModel {
  variant: SavedEmptyVariant;
  title: string;
  description?: string;
}

/**
 * Collection cards are not shown in mockup 14 (tabs for Events/Clubs/Artists only).
 * This model exists for future extension and is not rendered in preview.
 */
export interface CollectionViewModel {
  id: string;
  name: string;
  countLabel: string;
  cover?: EventCardViewModel['image'];
  private?: boolean;
  accessibilityLabel: string;
}
