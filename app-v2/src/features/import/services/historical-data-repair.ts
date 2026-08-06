import type { AdminEventRecord } from '@/data/types/records';

import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';

import {

  applyExplicitEventGeographyFields,

  candidateFixesSourceDefaultVenueMisapplication,

  eventHasSourceDefaultVenueMisapplied,

  readSourceDefaultVenueContext,

} from '@/features/import/services/source-default-venue-repair';

import {

  candidateCanRepairTicketPlatformEvent,

  eventNeedsTicketPlatformFieldRepair,

  readTicketPlatformContextFromMetadata,

  TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION,

} from '@/features/import/services/ticket-platform-field-repair';



/** Bumped when historical canonical rebuild semantics change (Phase 4.3.4+). */

export const HISTORICAL_DATA_REPAIR_VERSION = '4.6.6';



export {

  applyExplicitEventGeographyFields,

  candidateFixesSourceDefaultVenueMisapplication,

  eventHasSourceDefaultVenueMisapplied,

  readSourceDefaultVenueContext,

} from '@/features/import/services/source-default-venue-repair';



/** @deprecated Use eventHasSourceDefaultVenueMisapplied with source field defaults. */

export function eventHasWrongBootshausExternalVenue(

  event: AdminEventRecord | null | undefined,

): boolean {

  return eventHasSourceDefaultVenueMisapplied(event, {

    defaultVenueId: 'venue-bootshaus-koeln',

    defaultVenueName: 'Bootshaus',

    defaultCityName: 'Köln',

  });

}



/** @deprecated Use candidateFixesSourceDefaultVenueMisapplication. */

export function candidateFixesBootshausExternalVenue(

  candidate: CanonicalImportEvent,

  event: AdminEventRecord | null | undefined,

): boolean {

  return candidateFixesSourceDefaultVenueMisapplication(candidate, event, {

    defaultVenueId: 'venue-bootshaus-koeln',

    defaultVenueName: 'Bootshaus',

    defaultCityName: 'Köln',

  });

}



export function stampHistoricalRepairMetadata(

  sourceMetadata: Record<string, unknown> | undefined,

): Record<string, unknown> {

  return {

    ...(sourceMetadata ?? {}),

    dataQualityRepairVersion: HISTORICAL_DATA_REPAIR_VERSION,

    historicalRepairVersion: HISTORICAL_DATA_REPAIR_VERSION,

    ticketPlatformRepairVersion: TICKET_PLATFORM_DATA_QUALITY_REPAIR_VERSION,

  };

}



export function eventNeedsTitleLineupRepair(

  event: AdminEventRecord | null | undefined,

): boolean {

  if (!event?.title) {

    return false;

  }

  const titleArtists = extractArtistsFromEventTitle(event.title) ?? [];

  if (titleArtists.length === 0) {

    return false;

  }

  return !event.artistId;

}



export function eventNeedsHistoricalRepair(

  event: AdminEventRecord | null | undefined,

  context?: {

    connectorKey?: string;

    sourceType?: string;

    platform?: string;

    defaultVenue?: ReturnType<typeof readSourceDefaultVenueContext>;

  },

): boolean {

  if (!event) {

    return false;

  }

  if (eventNeedsTicketPlatformFieldRepair(event, context)) {

    return true;

  }

  if (eventHasSourceDefaultVenueMisapplied(event, context?.defaultVenue)) {

    return true;

  }

  if (eventNeedsTitleLineupRepair(event)) {

    return true;

  }

  return false;

}



export function candidateCanHistoricalRepair(

  candidate: CanonicalImportEvent,

  event: AdminEventRecord | null | undefined,

): boolean {

  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;

  const ticketContext = readTicketPlatformContextFromMetadata(metadata);

  const venueContext = readSourceDefaultVenueContext(metadata);



  if (candidateCanRepairTicketPlatformEvent(candidate, event, ticketContext)) {

    return true;

  }

  if (candidateFixesSourceDefaultVenueMisapplication(candidate, event, venueContext)) {

    return true;

  }

  if (eventNeedsTitleLineupRepair(event)) {

    const titleArtists = extractArtistsFromEventTitle(candidate.title ?? '') ?? [];

    return titleArtists.length > 0;

  }

  return false;

}



export function historicalRepairVersionChanged(

  recordRepairVersion: unknown,

  candidateRepairVersion: unknown,

): boolean {

  if (typeof candidateRepairVersion !== 'string' || candidateRepairVersion.length === 0) {

    return false;

  }

  return recordRepairVersion !== candidateRepairVersion;

}



/** @deprecated Use applyExplicitEventGeographyFields. */

export const applyExternalLocationAdminVenueFields = applyExplicitEventGeographyFields;


