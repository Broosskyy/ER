import type { WebsiteRunLimits } from '@/features/aggregation/connectors/website/limits';
import type { WebsiteTitleTransform } from '@/features/aggregation/connectors/website/title-transforms';
import type { WebsiteStrategyKey } from '@/features/aggregation/connectors/website/types';

export interface HtmlSelectorWebsiteConfig {
  eventContainerSelector?: string;
  titleSelector?: string;
  dateSelector?: string;
  timeSelector?: string;
  startDateAttribute?: string;
  endDateSelector?: string;
  venueSelector?: string;
  locationSelector?: string;
  descriptionSelector?: string;
  imageSelector?: string;
  imageAttribute?: string;
  eventUrlSelector?: string;
  eventUrlAttribute?: string;
  ticketUrlSelector?: string;
  ticketUrlAttribute?: string;
  lineupSelector?: string;
  genreSelector?: string;
  statusSelector?: string;
  paginationSelector?: string;
  nextPageSelector?: string;
  monthSelector?: string;
  linkIncludePattern?: string;
  baseUrl?: string;
  locale?: string;
  timezone?: string;
  dateFormats?: string[];
  attributeMappings?: Record<string, string>;
  textCleanupRules?: string[];
  requiredFields?: string[];
  optionalFieldRules?: Record<string, boolean>;
}

export interface EmbeddedJsonWebsiteConfig {
  collectionPaths?: string[];
  scriptType?: string;
  hydrationKeys?: string[];
}

export interface EventDetailPageWebsiteConfig {
  listPageUrl?: string;
  eventLinkSelector?: string;
  eventLinkAttribute?: string;
  allowedDomains?: string[];
  detailStrategy?: WebsiteStrategyKey;
  linkIncludePattern?: string;
}

export interface CustomWebsiteAdapterConfig {
  adapterKey?: string;
  options?: Record<string, unknown>;
}

export interface WebsiteConnectorConfig {
  preferredStrategy?: WebsiteStrategyKey;
  autoSelectStrategy?: boolean;
  userAgent?: string;
  acceptLanguage?: string;
  requestHeaders?: Record<string, string>;
  /** Optional post-extraction title cleanup rules (config-driven, no site-specific code). */
  transforms?: WebsiteTitleTransform[];
  htmlSelector?: HtmlSelectorWebsiteConfig;
  embeddedJson?: EmbeddedJsonWebsiteConfig;
  eventDetailPage?: EventDetailPageWebsiteConfig;
  customAdapter?: CustomWebsiteAdapterConfig;
  limits?: Partial<WebsiteRunLimits>;
}

export function resolveWebsiteConnectorConfig(
  sourceConfig?: { website?: WebsiteConnectorConfig },
): WebsiteConnectorConfig {
  return sourceConfig?.website ?? {};
}
