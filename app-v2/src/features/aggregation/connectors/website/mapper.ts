import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';
import {
  applyWebsiteTitleTransforms,
  type WebsiteTitleTransform,
} from '@/features/aggregation/connectors/website/title-transforms';
import { readWebsiteTextualEnrichmentMetadata } from '@/features/aggregation/connectors/website/website-textual-enrichment';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import {
  classifyOutboundTicketLink,
  pickBestOutboundTicketLink,
} from '@/features/aggregation/domain/cross-source-ticket-discovery';
import { filterArtistCandidatesThroughGate } from '@/features/events/domain/artist-candidate-quality-gate';

export function mapRawWebsiteEventToImportedEvent(
  event: RawWebsiteEvent,
  connectorKey: string,
  transforms?: WebsiteTitleTransform[],
): RawImportedEvent | null {
  if (!event.title && !event.rawStartDate) {
    return null;
  }

  const title = applyWebsiteTitleTransforms(event.title, transforms);

  const textual = readWebsiteTextualEnrichmentMetadata(event);
  const descriptionLineupRaw =
    !event.rawArtists?.length ? extractLineupNamesFromDescriptionText(event.rawDescription) : undefined;
  const descriptionLineup = descriptionLineupRaw
    ? filterArtistCandidatesThroughGate(descriptionLineupRaw, {
        sourceField: 'description',
        extractionStrategy: event.extractionStrategy,
        eventTitle: title,
      })
    : undefined;
  const lineupEntries = descriptionLineup?.length
    ? descriptionLineup.map((displayName) => ({
        displayName,
        source: 'html_lineup' as const,
        confidence: 0.75,
      }))
    : undefined;
  const classifiedTicketLinks = [
    ...(event.rawTicketLinks ?? []).map((url) => classifyOutboundTicketLink(url)),
    ...textual.outboundTicketLinks,
  ];
  const bestTicket = pickBestOutboundTicketLink(classifiedTicketLinks);
  const minimumAgeNumber = textual.minimumAge
    ? Number.parseInt(textual.minimumAge.replace(/\D/g, ''), 10)
    : undefined;

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
    ticketUrl: bestTicket?.url ?? event.rawTicketLinks?.[0],
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
      textualEnrichment: textual,
      runningOrder: textual.runningOrder,
      timetable: textual.timetable,
      eventAttributes: textual.attributes,
      doorsOpenAt: textual.doorsOpenAt,
      minimumAge: textual.minimumAge,
      floorCount: textual.floorCount,
      venueEnvironment: textual.venueEnvironment,
      outboundTicketLinks: textual.outboundTicketLinks,
      ...(lineupEntries?.length ? { lineupEntries } : {}),
      ...(event.officialDetailHtml ? { officialDetailHtml: event.officialDetailHtml } : {}),
    },
    cancelled: event.rawStatus?.toLowerCase() === 'cancelled',
    ...(Number.isFinite(minimumAgeNumber) ? { minimumAge: minimumAgeNumber } : {}),
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
