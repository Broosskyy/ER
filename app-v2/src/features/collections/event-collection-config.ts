import { FEATURED_EVENT_IDS, isFeaturedEventId } from '@/features/events/data/home-config';
import type { Event } from '@/features/events/types/event';
import {
  getMoreUpcomingEvents,
  getTonightEvents,
  getWeekendEvents,
} from '@/features/home/utils/home-sections';
import { getSearchGenreLabel, type SearchGenreChipId } from '@/features/search/constants';

export type CollectionType =
  | 'highlights'
  | 'tonight'
  | 'weekend'
  | 'upcoming'
  | 'techno'
  | 'hard-techno'
  | 'house'
  | 'trance'
  | 'psy'
  | 'industrial'
  | 'drum-and-bass';

export interface EventCollectionConfig {
  type: CollectionType;
  title: string;
  subtitle?: string;
  emptyTitle: string;
  emptyDescription: string;
  homePreviewLimit: number;
  showOnHome: boolean;
  selectEvents: (events: Event[]) => Event[];
}

function matchesGenreCollection(event: Event, genreId: SearchGenreChipId): boolean {
  const genreLabel = getSearchGenreLabel(genreId).toLowerCase();
  return event.genres.some((genre) => genre.toLowerCase() === genreLabel);
}


export const EVENT_COLLECTIONS: Record<CollectionType, EventCollectionConfig> = {
  highlights: {
    type: 'highlights',
    title: 'Events in deiner Nähe',
    subtitle: 'Ausgewählte Events in Köln',
    emptyTitle: 'Keine Highlights',
    emptyDescription: 'Derzeit sind keine ausgewählten Events verfügbar.',
    homePreviewLimit: 3,
    showOnHome: true,
    selectEvents: (events) =>
      FEATURED_EVENT_IDS.map((id) => events.find((event) => event.id === id)).filter(
        (event): event is Event => Boolean(event),
      ),
  },
  tonight: {
    type: 'tonight',
    title: 'Heute Abend',
    subtitle: 'Events heute Abend in Köln',
    emptyTitle: 'Keine Events heute Abend',
    emptyDescription: 'Derzeit sind keine Events für heute Abend verfügbar.',
    homePreviewLimit: 6,
    showOnHome: true,
    selectEvents: (events) => getTonightEvents(events),
  },
  weekend: {
    type: 'weekend',
    title: 'Dieses Wochenende',
    subtitle: 'Events dieses Wochenende in Köln',
    emptyTitle: 'Keine Events am Wochenende',
    emptyDescription: 'Derzeit sind keine Events für dieses Wochenende verfügbar.',
    homePreviewLimit: 3,
    showOnHome: true,
    selectEvents: (events) => getWeekendEvents(events),
  },
  upcoming: {
    type: 'upcoming',
    title: 'Demnächst',
    subtitle: 'Kommende Events in Köln',
    emptyTitle: 'Keine kommenden Events',
    emptyDescription: 'Derzeit sind keine kommenden Events verfügbar.',
    homePreviewLimit: 3,
    showOnHome: true,
    selectEvents: (events) => getMoreUpcomingEvents(events),
  },
  techno: {
    type: 'techno',
    title: 'Techno',
    subtitle: 'Techno events in Köln',
    emptyTitle: 'No techno events',
    emptyDescription: 'There are currently no published techno events.',
    homePreviewLimit: 3,
    showOnHome: true,
    selectEvents: (events) => events.filter((event) => matchesGenreCollection(event, 'techno')),
  },
  'hard-techno': {
    type: 'hard-techno',
    title: 'Hard Techno',
    subtitle: 'Hard techno events in Köln',
    emptyTitle: 'No hard techno events',
    emptyDescription: 'There are currently no published hard techno events.',
    homePreviewLimit: 3,
    showOnHome: false,
    selectEvents: (events) =>
      events.filter((event) => matchesGenreCollection(event, 'hard-techno')),
  },
  house: {
    type: 'house',
    title: 'House',
    subtitle: 'House events in Köln',
    emptyTitle: 'No house events',
    emptyDescription: 'There are currently no published house events.',
    homePreviewLimit: 3,
    showOnHome: true,
    selectEvents: (events) => events.filter((event) => matchesGenreCollection(event, 'house')),
  },
  trance: {
    type: 'trance',
    title: 'Trance',
    subtitle: 'Trance events in Köln',
    emptyTitle: 'No trance events',
    emptyDescription: 'There are currently no published trance events.',
    homePreviewLimit: 3,
    showOnHome: false,
    selectEvents: (events) => events.filter((event) => matchesGenreCollection(event, 'trance')),
  },
  psy: {
    type: 'psy',
    title: 'Psy',
    subtitle: 'Psy events in Köln',
    emptyTitle: 'No psy events',
    emptyDescription: 'There are currently no published psy events.',
    homePreviewLimit: 3,
    showOnHome: false,
    selectEvents: (events) => events.filter((event) => matchesGenreCollection(event, 'psy')),
  },
  industrial: {
    type: 'industrial',
    title: 'Industrial',
    subtitle: 'Industrial events in Köln',
    emptyTitle: 'No industrial events',
    emptyDescription: 'There are currently no published industrial events.',
    homePreviewLimit: 3,
    showOnHome: false,
    selectEvents: (events) =>
      events.filter((event) => matchesGenreCollection(event, 'industrial')),
  },
  'drum-and-bass': {
    type: 'drum-and-bass',
    title: 'Drum & Bass',
    subtitle: 'Drum & bass events in Köln',
    emptyTitle: 'No drum & bass events',
    emptyDescription: 'There are currently no published drum & bass events.',
    homePreviewLimit: 3,
    showOnHome: false,
    selectEvents: (events) =>
      events.filter((event) => matchesGenreCollection(event, 'drum-and-bass')),
  },
};

export const HOME_COLLECTION_TYPES: CollectionType[] = (
  Object.values(EVENT_COLLECTIONS) as EventCollectionConfig[]
)
  .filter((collection) => collection.showOnHome)
  .map((collection) => collection.type);

export function isCollectionType(value: string | undefined): value is CollectionType {
  return Boolean(value && value in EVENT_COLLECTIONS);
}

export function getCollectionConfig(type: CollectionType): EventCollectionConfig {
  return EVENT_COLLECTIONS[type];
}
