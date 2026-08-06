import type { CollectionType } from '@/features/collections/event-collection-config';
import { getSearchGenreLabel, type SearchGenreChipId } from '@/features/search/constants';

import type { HomeFeedSectionDefinition } from './home-feed-types';

export type { HomeFeedSectionDefinition } from './home-feed-types';

/** Single source of truth for Home preview counts (configurable 5–6). */
export const DEFAULT_HOME_LIST_PREVIEW_LIMIT = 6;
export const DEFAULT_HOME_RAIL_PREVIEW_LIMIT = 6;

/**
 * Home hierarchy:
 * - Large hero rails: trending, featured, highlights (never stacked back-to-back)
 * - Compact lists: today, this week, weekend, next week, newly added, nearby
 * - Venue rails: clubs, venues (separate smaller components)
 */
export const HOME_FEED_SECTIONS: HomeFeedSectionDefinition[] = [
  {
    id: 'trending',
    preset: 'trending',
    title: 'Trending',
    layout: 'rail',
    previewLimit: DEFAULT_HOME_RAIL_PREVIEW_LIMIT,
    collectionType: 'highlights',
    showOnHome: true,
    emptyTitle: 'Keine Trending-Events',
    emptyDescription: 'Derzeit sind keine Trending-Events verfügbar.',
  },
  {
    id: 'today',
    preset: 'today',
    title: 'Heute',
    layout: 'list',
    previewLimit: DEFAULT_HOME_LIST_PREVIEW_LIMIT,
    collectionType: 'tonight',
    showOnHome: true,
    emptyTitle: 'Keine Events heute',
    emptyDescription: 'Heute sind keine Events in deiner Nähe.',
  },
  {
    id: 'featured',
    preset: 'upcoming-highlights',
    title: 'Featured',
    layout: 'rail',
    previewLimit: DEFAULT_HOME_RAIL_PREVIEW_LIMIT,
    collectionType: 'highlights',
    showOnHome: true,
    emptyTitle: 'Keine Featured-Events',
    emptyDescription: 'Derzeit sind keine Featured-Events verfügbar.',
  },
  {
    id: 'this-week',
    preset: 'this-week',
    title: 'Diese Woche',
    layout: 'list',
    previewLimit: DEFAULT_HOME_LIST_PREVIEW_LIMIT,
    collectionType: 'upcoming',
    showOnHome: true,
    emptyTitle: 'Keine Events diese Woche',
    emptyDescription: 'Diese Woche sind keine Events verfügbar.',
  },
  {
    id: 'weekend',
    preset: 'weekend',
    title: 'Dieses Wochenende',
    layout: 'list',
    previewLimit: DEFAULT_HOME_LIST_PREVIEW_LIMIT,
    collectionType: 'weekend',
    showOnHome: true,
    emptyTitle: 'Keine Events am Wochenende',
    emptyDescription: 'Dieses Wochenende sind keine Events verfügbar.',
  },
  {
    id: 'upcoming-highlights',
    preset: 'upcoming-highlights',
    title: 'Kommende Highlights',
    layout: 'rail',
    previewLimit: DEFAULT_HOME_RAIL_PREVIEW_LIMIT,
    collectionType: 'upcoming',
    showOnHome: true,
    emptyTitle: 'Keine Highlights',
    emptyDescription: 'Derzeit sind keine kommenden Highlights verfügbar.',
  },
  {
    id: 'next-week',
    preset: 'next-week',
    title: 'Nächste Woche',
    layout: 'list',
    previewLimit: DEFAULT_HOME_LIST_PREVIEW_LIMIT,
    collectionType: 'upcoming',
    showOnHome: true,
    emptyTitle: 'Keine Events nächste Woche',
    emptyDescription: 'Nächste Woche sind keine Events verfügbar.',
  },
  {
    id: 'newly-added',
    preset: 'newly-added',
    title: 'Neu hinzugefügt',
    layout: 'list',
    previewLimit: DEFAULT_HOME_LIST_PREVIEW_LIMIT,
    collectionType: 'upcoming',
    showOnHome: true,
    emptyTitle: 'Keine neuen Events',
    emptyDescription: 'Derzeit wurden keine neuen Events veröffentlicht.',
  },
  {
    id: 'nearby',
    preset: 'nearby',
    title: 'In deiner Nähe',
    layout: 'list',
    previewLimit: DEFAULT_HOME_LIST_PREVIEW_LIMIT,
    requiresLocation: true,
    showOnHome: true,
    emptyTitle: 'Keine Events in der Nähe',
    emptyDescription: 'Aktiviere deinen Standort oder wähle eine Stadt.',
  },
];

export const HOME_FEED_RAIL_SECTIONS = new Set(
  HOME_FEED_SECTIONS.filter((section) => section.layout === 'rail').map((section) => section.id),
);

export function getHomeFeedSection(id: string): HomeFeedSectionDefinition | undefined {
  return HOME_FEED_SECTIONS.find((section) => section.id === id);
}

export function getVisibleHomeFeedSections(): HomeFeedSectionDefinition[] {
  return HOME_FEED_SECTIONS.filter((section) => section.showOnHome);
}

const COLLECTION_TO_SECTION: Partial<Record<CollectionType, string>> = {
  highlights: 'trending',
  tonight: 'today',
  weekend: 'weekend',
  upcoming: 'upcoming-highlights',
  techno: 'genre-techno',
  house: 'genre-house',
  'hard-techno': 'genre-hard-techno',
  trance: 'genre-trance',
  psy: 'genre-psy',
  industrial: 'genre-industrial',
  'drum-and-bass': 'genre-drum-and-bass',
};

export function getCollectionFeedSection(type: CollectionType): HomeFeedSectionDefinition {
  const mappedId = COLLECTION_TO_SECTION[type];
  const existing = mappedId ? getHomeFeedSection(mappedId) : undefined;
  if (existing) {
    return { ...existing, previewLimit: 24, collectionType: type };
  }

  return {
    id: `collection-${type}`,
    preset: 'genre',
    title: type,
    layout: 'list',
    previewLimit: 24,
    collectionType: type,
    genreLabel: getSearchGenreLabel(type as SearchGenreChipId),
    showOnHome: false,
    emptyTitle: 'Keine Events',
    emptyDescription: 'Derzeit sind keine Events in dieser Collection verfügbar.',
  };
}
