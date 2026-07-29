import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';
import {
  applyWebsiteTitleTransforms,
  type WebsiteTitleTransform,
} from '@/features/aggregation/connectors/website/title-transforms';

export function mapRawWebsiteEventToImportedEvent(
  event: RawWebsiteEvent,
  connectorKey: string,
  transforms?: WebsiteTitleTransform[],
): RawImportedEvent | null {
  if (!event.title && !event.rawStartDate) {
    return null;
  }

  const title = applyWebsiteTitleTransforms(event.title, transforms);

  return {
    externalId: event.externalId,
    importId: event.externalId,
    sourceUrl: event.detailUrl ?? event.sourceUrl,
    originalLink: event.detailUrl ?? event.sourceUrl,
    title,
    description: event.rawDescription,
    startDate: event.rawStartDate,
    endDate: event.rawEndDate,
    venueName: event.rawVenue,
    venueAddress: event.rawLocation,
    artistNames: event.rawArtists,
    genreNames: event.rawGenres,
    ticketUrl: event.rawTicketLinks?.[0],
    imageUrl: event.rawImages?.[0],
    imageUrls: event.rawImages,
    organizerName: event.rawOrganizer,
    rawSourceType: event.extractionStrategy === 'json_ld' ? 'json_ld' : 'unknown',
    sourceMetadata: {
      connector: connectorKey,
      extractionStrategy: event.extractionStrategy,
      extractionConfidence: event.extractionConfidence,
      fieldEvidence: event.fieldEvidence,
      warnings: event.warnings,
    },
    cancelled: event.rawStatus?.toLowerCase() === 'cancelled',
  };
}

export function mapRawWebsiteEvents(
  events: RawWebsiteEvent[],
  connectorKey: string,
  transforms?: WebsiteTitleTransform[],
): RawImportedEvent[] {
  return events
    .map((event) => mapRawWebsiteEventToImportedEvent(event, connectorKey, transforms))
    .filter((event): event is RawImportedEvent => event !== null);
}
