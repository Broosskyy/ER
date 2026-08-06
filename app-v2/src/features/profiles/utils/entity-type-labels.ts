import type { VenueType } from '@/features/events/domain/festival-foundation';

/** Canonical public labels for entity profile headers — no venue-specific overrides. */
export function resolveVenuePublicTypeLabel(venueType?: VenueType): string {
  switch (venueType) {
    case 'club':
      return 'Club';
    case 'warehouse':
      return 'Warehouse';
    case 'open_air':
      return 'Open Air';
    case 'festival_ground':
      return 'Festival Ground';
    case 'temporary':
      return 'Temporary Venue';
    case 'hybrid':
      return 'Club / Outdoor';
    default:
      return 'Venue';
  }
}

export function buildEntityHandleLabel(entityLabel: string, city?: string): string {
  const trimmedCity = city?.trim();
  return trimmedCity ? `${entityLabel} · ${trimmedCity}` : entityLabel;
}
