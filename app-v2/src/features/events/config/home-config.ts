export const HOME_FILTER_CHIPS = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'weekend', label: 'Wochenende' },
  { id: 'this-week', label: 'Diese Woche' },
] as const;

export type HomeFilterChipId = (typeof HOME_FILTER_CHIPS)[number]['id'];

export const HOME_GENRE_CHIPS = [
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
  { id: 'trance', label: 'Trance' },
  { id: 'drum-and-bass', label: 'Drum & Bass' },
] as const;

export const FEATURED_EVENT_IDS: string[] = [];

export function isFeaturedEventId(_eventId: string): boolean {
  return false;
}
