export interface FeedFieldMapping {
  titleField?: string;
  descriptionField?: string;
  urlField?: string;
  imageField?: string;
  dateField?: string;
  externalIdField?: string;
  locationField?: string;
  eventDateField?: string;
}

export interface CsvFieldMapping {
  externalId?: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  artistNames?: string;
  genreNames?: string;
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  minimumAge?: string;
  organizerName?: string;
}

export interface CsvSourceConfig {
  delimiter?: ',' | ';' | '\t';
  hasHeader?: boolean;
  dateFormat?: string;
  encoding?: string;
  maxSizeBytes?: number;
  fieldMapping: CsvFieldMapping;
}

export interface ApiJsonSourceConfig {
  resultsPath?: string;
  fieldMapping: CsvFieldMapping;
  queryParams?: Record<string, string>;
  /** Header names only — values resolved from environment at runtime */
  headerNames?: string[];
}

export interface FeedSourceConfig extends FeedFieldMapping {
  feedUrl?: string;
}

export interface IcalSourceConfig {
  maxRecurrenceInstances?: number;
}

export interface JsonLdSourceConfig {
  pageUrl?: string;
}

export type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
export type { TicketPlatformSourceConfig } from '@/features/aggregation/connectors/ticket-platform/types';

export interface SourceFieldDefaults {
  cityName?: string;
  cityId?: string;
  venueName?: string;
  venueId?: string;
  organizerName?: string;
  organizerId?: string;
  countryCode?: string;
  address?: string;
  postalCode?: string;
  venueAddress?: string;
  /** When ticket URL is absent, copy from event/detail URL. */
  ticketUrlFallback?: 'eventUrl';
}

export interface ImportSourceConfig {
  feed?: FeedSourceConfig;
  csv?: CsvSourceConfig;
  api?: ApiJsonSourceConfig;
  ical?: IcalSourceConfig;
  jsonLd?: JsonLdSourceConfig;
  website?: import('@/features/aggregation/connectors/website/config').WebsiteConnectorConfig;
  ticketPlatform?: import('@/features/aggregation/connectors/ticket-platform/types').TicketPlatformSourceConfig;
  /** Bundled reference payloads for manual / fixture-driven imports. */
  reference?: import('@/features/aggregation/connectors/types').ReferenceSourceConfig;
  /** Connector assignment metadata (ER-013) — legacy single-connector assignment. */
  connector?: import('@/features/connectors/domain/connector-config').ConnectorSourceAssignment;
  /**
   * Acquisition endpoints owned by this source (ER-014).
   * One Source → many Endpoints. Persisted in source JSON until dedicated table exists.
   */
  endpoints?: import('@/features/endpoints/domain/endpoint-model').AcquisitionEndpoint[];
  /** Regional defaults for normalization and filtering. */
  regional?: {
    countryCode?: string;
    languageCode?: string;
  };
  /** Auth metadata only — no secrets stored in source config. */
  auth?: import('@/features/aggregation/domain/source-auth-config').SourceAuthConfig;
  /** Per-source connector framework overrides (retry / rate limit). */
  connectorFramework?: import('@/features/aggregation/connectors/framework/config').SourceConnectorFrameworkOverrides;
  /** Publish policy overrides (Sprint 13). */
  publishPolicy?: import('@/features/import/domain/publish-mode').PublishPolicyConfig;
  /** Normalization defaults for missing connector fields (Sprint 26.8). */
  defaults?: SourceFieldDefaults;
}
