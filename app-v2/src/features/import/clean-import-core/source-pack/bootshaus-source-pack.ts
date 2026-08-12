import { PRODUCTION_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/production-source-records';
import { TICKET_IO_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/ticket-io-source.core';

export const BOOTSHAUS_OFFICIAL_SOURCE_ID = PRODUCTION_BOOTSHAUS_SOURCE_ID;
export const BOOTSHAUS_TICKET_SOURCE_ID = TICKET_IO_BOOTSHAUS_SOURCE_ID;

export const BOOTSHAUS_SOURCE_PACK = {
  id: 'bootshaus-koeln',
  displayName: 'Bootshaus Köln',
  officialSourceId: BOOTSHAUS_OFFICIAL_SOURCE_ID,
  ticketSourceId: BOOTSHAUS_TICKET_SOURCE_ID,
  officialFields: [
    'title',
    'startDate',
    'endDate',
    'venueName',
    'venueAddress',
    'venuePostalCode',
    'venueCity',
    'countryCode',
    'websiteUrl',
    'description',
    'imageUrl',
    'genreLabels',
    'lineup',
    'minimumAge',
    'organizerName',
  ] as const,
  ticketFields: ['ticketUrl', 'priceText', 'ticketPhases', 'ticketStatus', 'verifiedAt'] as const,
} as const;

export type BootshausOfficialField = (typeof BOOTSHAUS_SOURCE_PACK.officialFields)[number];
export type BootshausTicketField = (typeof BOOTSHAUS_SOURCE_PACK.ticketFields)[number];
