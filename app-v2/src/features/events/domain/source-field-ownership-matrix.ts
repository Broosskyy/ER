import type { SourcePriorityTier } from '@/features/events/domain/field-ownership-policy';

export type SourceFieldTrustRating = 1 | 2 | 3 | 4 | 5;

export interface SourceFieldOwnershipEntry {
  field: string;
  website: SourceFieldTrustRating;
  ticketPlatform: SourceFieldTrustRating;
  officialOrganizer: SourceFieldTrustRating;
  ticketIo: SourceFieldTrustRating;
  ownerTier: SourcePriorityTier;
  mergeRule: 'owner_wins' | 'fill_only' | 'highest_quality' | 'never_downgrade';
  notes: string;
}

/**
 * Field-based ownership matrix for Phase 4.4.
 * Trust is per field and source type — never one global score.
 */
export const SOURCE_FIELD_OWNERSHIP_MATRIX: SourceFieldOwnershipEntry[] = [
  {
    field: 'description',
    website: 5,
    ticketPlatform: 2,
    officialOrganizer: 5,
    ticketIo: 3,
    ownerTier: 'official_organizer',
    mergeRule: 'never_downgrade',
    notes: 'Website/organizer prose wins. Ticket.io may fill only when canonical is empty or placeholder.',
  },
  {
    field: 'venueName',
    website: 5,
    ticketPlatform: 2,
    officialOrganizer: 4,
    ticketIo: 2,
    ownerTier: 'official_venue',
    mergeRule: 'owner_wins',
    notes: 'Official venue/club website identity wins over ticket shop defaults.',
  },
  {
    field: 'venueAddress',
    website: 5,
    ticketPlatform: 1,
    officialOrganizer: 4,
    ticketIo: 1,
    ownerTier: 'official_venue',
    mergeRule: 'owner_wins',
    notes: 'Address from official website or venue entity.',
  },
  {
    field: 'cityName',
    website: 5,
    ticketPlatform: 2,
    officialOrganizer: 4,
    ticketIo: 2,
    ownerTier: 'official_venue',
    mergeRule: 'owner_wins',
    notes: 'Explicit event geography beats source defaults.',
  },
  {
    field: 'countryCode',
    website: 5,
    ticketPlatform: 1,
    officialOrganizer: 4,
    ticketIo: 1,
    ownerTier: 'official_venue',
    mergeRule: 'owner_wins',
    notes: 'Country from official geography.',
  },
  {
    field: 'organizerName',
    website: 5,
    ticketPlatform: 1,
    officialOrganizer: 5,
    ticketIo: 1,
    ownerTier: 'official_organizer',
    mergeRule: 'fill_only',
    notes: 'Ticket enrichment may fill missing organizer only.',
  },
  {
    field: 'lineup',
    website: 4,
    ticketPlatform: 3,
    officialOrganizer: 5,
    ticketIo: 4,
    ownerTier: 'official_organizer',
    mergeRule: 'highest_quality',
    notes: 'Structured lineup > known artists > title-derived artists.',
  },
  {
    field: 'ticketUrl',
    website: 2,
    ticketPlatform: 5,
    officialOrganizer: 2,
    ticketIo: 5,
    ownerTier: 'ticket_platform',
    mergeRule: 'owner_wins',
    notes: 'Checkout URL owned by ticketing origin.',
  },
  {
    field: 'priceText',
    website: 1,
    ticketPlatform: 5,
    officialOrganizer: 1,
    ticketIo: 5,
    ownerTier: 'ticket_platform',
    mergeRule: 'fill_only',
    notes: 'Prices from ticket platform only; never overwrite with empty.',
  },
  {
    field: 'ticketStatus',
    website: 1,
    ticketPlatform: 5,
    officialOrganizer: 1,
    ticketIo: 5,
    ownerTier: 'ticket_platform',
    mergeRule: 'owner_wins',
    notes: 'Availability/sold-out from ticket platform.',
  },
  {
    field: 'imageUrl',
    website: 4,
    ticketPlatform: 3,
    officialOrganizer: 4,
    ticketIo: 3,
    ownerTier: 'official_organizer',
    mergeRule: 'highest_quality',
    notes: 'Prefer official website hero; ticket.io may fill when missing.',
  },
  {
    field: 'genres',
    website: 3,
    ticketPlatform: 2,
    officialOrganizer: 4,
    ticketIo: 2,
    ownerTier: 'official_organizer',
    mergeRule: 'never_downgrade',
    notes: 'Never replace non-empty genre list with empty.',
  },
  {
    field: 'title',
    website: 4,
    ticketPlatform: 3,
    officialOrganizer: 5,
    ticketIo: 4,
    ownerTier: 'official_organizer',
    mergeRule: 'owner_wins',
    notes: 'Official naming wins; ticket.io title is enrichment hint only.',
  },
  {
    field: 'startDate',
    website: 4,
    ticketPlatform: 4,
    officialOrganizer: 5,
    ticketIo: 4,
    ownerTier: 'official_organizer',
    mergeRule: 'owner_wins',
    notes: 'Schedule from official source; ticket.io may correct time when matched.',
  },
  {
    field: 'socialLinks',
    website: 5,
    ticketPlatform: 1,
    officialOrganizer: 4,
    ticketIo: 1,
    ownerTier: 'official_organizer',
    mergeRule: 'owner_wins',
    notes: 'Instagram/Facebook/website from official website only.',
  },
  {
    field: 'coordinates',
    website: 5,
    ticketPlatform: 1,
    officialOrganizer: 4,
    ticketIo: 1,
    ownerTier: 'official_venue',
    mergeRule: 'owner_wins',
    notes: 'Google Maps / venue entity coordinates.',
  },
  {
    field: 'providerLabel',
    website: 1,
    ticketPlatform: 5,
    officialOrganizer: 1,
    ticketIo: 5,
    ownerTier: 'ticket_platform',
    mergeRule: 'owner_wins',
    notes: 'Ticket provider attribution from ticket URL origin.',
  },
];

export function getSourceFieldOwnership(field: string): SourceFieldOwnershipEntry | undefined {
  return SOURCE_FIELD_OWNERSHIP_MATRIX.find((entry) => entry.field === field);
}
