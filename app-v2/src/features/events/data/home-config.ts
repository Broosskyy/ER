export const HOME_FILTER_CHIPS = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'weekend', label: 'Dieses Wochenende' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
] as const;

export type HomeFilterChipId = (typeof HOME_FILTER_CHIPS)[number]['id'];

export const FEATURED_EVENT_IDS = [
  'void-techno-saturday',
  'klangkuenstler-berghain',
  'electric-avenue',
] as const;

export function isFeaturedEventId(eventId: string): boolean {
  return (FEATURED_EVENT_IDS as readonly string[]).includes(eventId);
}
