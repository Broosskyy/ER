/** Canonical fields tracked by the Source Reliability Framework (Phase 4.7.0). */
export const SOURCE_CAPABILITY_FIELDS = [
  'title',
  'description',
  'lineup',
  'ticketUrl',
  'eventUrl',
  'genres',
  'priceText',
  'ticketStatus',
  'ticketPhases',
  'venueName',
  'venueAddress',
  'coordinates',
  'doorsOpenAt',
  'minimumAge',
  'attributes',
  'images',
  'timetable',
  'faq',
  'organizerName',
] as const;

export type SourceCapabilityField = (typeof SOURCE_CAPABILITY_FIELDS)[number];

export type SourceOriginType =
  | 'website'
  | 'ticket_platform'
  | 'social'
  | 'flyer'
  | 'manual'
  | 'api';

export function mapSourceTypeToOriginType(
  sourceType: string,
  connectorKey?: string,
): SourceOriginType {
  if (sourceType === 'ticket_platform' || connectorKey === 'ticket_platform') {
    return 'ticket_platform';
  }
  if (sourceType === 'website' || connectorKey?.includes('website')) {
    return 'website';
  }
  if (sourceType === 'social') {
    return 'social';
  }
  if (sourceType === 'api') {
    return 'api';
  }
  if (sourceType === 'manual') {
    return 'manual';
  }
  return 'website';
}
