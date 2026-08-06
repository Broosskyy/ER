import type { RawSourceType } from '@/features/import/models/normalized-event-candidate';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { ImportSource } from '@/features/import/models/types';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

export const SOURCE_CONNECTOR_KEYS = [
  'manual_reference',
  'club_website',
  'organizer_website',
  'ical_feed',
  'open_data_api',
  'rss_feed',
  'atom_feed',
  'csv_import',
  'ticket_platform',
] as const;

export type SourceConnectorKey = (typeof SOURCE_CONNECTOR_KEYS)[number];

/** Raw event extracted by a connector — not yet canonical. */
export interface RawImportedEvent {
  externalId: string;
  importId: string;
  sourceUrl?: string;
  originalLink?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  isAllDay?: boolean;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  genreNames?: string[];
  artistNames?: string[];
  organizerName?: string;
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  imageUrls?: string[];
  priceAmount?: number;
  priceCurrency?: string;
  priceText?: string;
  minimumAge?: number;
  rawSourceType: RawSourceType;
  sourceMetadata?: Record<string, unknown>;
  cancelled?: boolean;
}

export interface ReferenceSourceConfig {
  connectorKey?: SourceConnectorKey;
  events?: RawImportedEvent[];
  html?: string;
  ical?: string;
  feed?: string;
  csv?: string;
  apiJson?: string | Record<string, unknown>;
}

export interface SourceConnector {
  readonly connectorKey: SourceConnectorKey;
  fetchRawEvents(
    source: AggregationSource,
    importSource: ImportSource,
    context: PipelineRunContext,
  ): Promise<RawImportedEvent[]>;
}

export function rawEventToFetchedPayload(event: RawImportedEvent) {
  return {
    externalId: event.externalId,
    sourceUrl: event.sourceUrl ?? event.originalLink,
    rawPayload: event as unknown as Record<string, unknown>,
  };
}
