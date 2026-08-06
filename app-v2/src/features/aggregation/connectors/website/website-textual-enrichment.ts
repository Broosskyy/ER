import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';
import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';
import {
  extractRunningOrderFromDescriptionText,
  extractTimetableFromDescriptionText,
} from '@/features/aggregation/domain/textual-timetable-parser';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import {
  extractOutboundTicketLinksFromText,
  pickBestOutboundTicketLink,
} from '@/features/aggregation/domain/cross-source-ticket-discovery';
import { extractOutboundTicketLinksFromHtml } from '@/features/aggregation/domain/outbound-ticket-html-discovery';
import { filterArtistCandidatesThroughGate } from '@/features/events/domain/artist-candidate-quality-gate';
import type { RunningOrderEntry, TimetableSlotEntry, SourcedEventAttribute } from '@/features/aggregation/domain/event-structured-detail';
import type { ClassifiedOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';

export interface WebsiteTextualEnrichmentMetadata {
  runningOrder?: RunningOrderEntry[];
  timetable?: TimetableSlotEntry[];
  attributes: SourcedEventAttribute[];
  minimumAge?: string;
  doorsOpenAt?: string;
  floorCount?: number;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
  outboundTicketLinks: ClassifiedOutboundTicketLink[];
}

function mergeArtistLists(...lists: Array<string[] | undefined>): string[] | undefined {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const name of list ?? []) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(name.trim());
    }
  }
  return merged.length > 0 ? merged : undefined;
}

/** Apply generic textual parsers to website events (description, timetable, attributes, ticket links). */
export function enrichWebsiteEventFromTextualSources(
  event: RawWebsiteEvent,
  htmlContext?: string,
): RawWebsiteEvent {
  const description = event.rawDescription;
  const rawDescriptionArtists = extractLineupNamesFromDescriptionText(description);
  const descriptionArtists =
    rawDescriptionArtists && rawDescriptionArtists.length > 0 && !event.rawArtists?.length
      ? filterArtistCandidatesThroughGate(rawDescriptionArtists, {
          sourceField: 'description',
          extractionStrategy: event.extractionStrategy,
        })
      : undefined;
  const runningOrder = extractRunningOrderFromDescriptionText(description, 'website_description');
  const runningOrderNames = runningOrder?.map((entry) => entry.displayName);
  const timetable = extractTimetableFromDescriptionText(description, 'website_description');
  const attributes = extractAttributesFromDescriptionText(description, 'website_description');
  const outboundLinks = [
    ...extractOutboundTicketLinksFromText(description),
    ...extractOutboundTicketLinksFromHtml(htmlContext),
  ];
  const bestTicket = pickBestOutboundTicketLink(outboundLinks);

  const mergedArtists = mergeArtistLists(event.rawArtists, descriptionArtists, runningOrderNames);
  const mergedTicketLinks = [...(event.rawTicketLinks ?? [])];
  if (bestTicket && !mergedTicketLinks.includes(bestTicket.url)) {
    mergedTicketLinks.unshift(bestTicket.url);
  }

  const warnings = [...event.warnings];
  if (descriptionArtists?.length) {
    warnings.push('textual_lineup_from_description');
  }
  if (runningOrder?.length) {
    warnings.push('textual_running_order_from_description');
  }
  if (timetable?.length) {
    warnings.push('textual_timetable_from_description');
  }
  if (attributes.attributes.length) {
    warnings.push('textual_attributes_from_description');
  }
  if (bestTicket) {
    warnings.push(`cross_source_ticket_link:${bestTicket.class}`);
  }

  return {
    ...event,
    rawArtists: mergedArtists,
    rawTicketLinks: mergedTicketLinks.length > 0 ? mergedTicketLinks : event.rawTicketLinks,
    warnings,
    fieldEvidence: [
      ...event.fieldEvidence,
      ...(descriptionArtists?.length
        ? [
            {
              field: 'artists',
              strategy: event.extractionStrategy,
              sourceUrl: event.detailUrl ?? event.sourceUrl,
              confidence: 0.75,
              extractedAt: new Date().toISOString(),
              rawValue: descriptionArtists.join(', '),
            },
          ]
        : []),
    ],
  };
}

export function enrichWebsiteEventsFromTextualSources(events: RawWebsiteEvent[]): RawWebsiteEvent[] {
  return events.map((event) => enrichWebsiteEventFromTextualSources(event));
}

export function readWebsiteTextualEnrichmentMetadata(
  event: RawWebsiteEvent,
): WebsiteTextualEnrichmentMetadata {
  const description = event.rawDescription;
  const attributeFields = extractAttributesFromDescriptionText(description, 'website_description');
  return {
    runningOrder: extractRunningOrderFromDescriptionText(description, 'website_description'),
    timetable: extractTimetableFromDescriptionText(description, 'website_description'),
    attributes: attributeFields.attributes,
    minimumAge: attributeFields.minimumAge,
    doorsOpenAt: attributeFields.doorsOpenAt,
    floorCount: attributeFields.floorCount,
    venueEnvironment: attributeFields.venueEnvironment,
    outboundTicketLinks: extractOutboundTicketLinksFromText(description),
  };
}
