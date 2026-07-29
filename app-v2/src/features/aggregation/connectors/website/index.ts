export type {
  RawWebsiteEvent,
  WebsiteDetectionReport,
  WebsiteDocument,
  WebsiteExtractionDiagnostics,
  WebsiteExtractionResult,
  WebsiteFieldEvidence,
  WebsiteStrategyKey,
} from '@/features/aggregation/connectors/website/types';

export {
  WEBSITE_DEFAULT_LIMITS,
  resolveWebsiteRunLimits,
} from '@/features/aggregation/connectors/website/limits';

export type {
  WebsiteConnectorConfig,
  HtmlSelectorWebsiteConfig,
  EmbeddedJsonWebsiteConfig,
  EventDetailPageWebsiteConfig,
} from '@/features/aggregation/connectors/website/config';

export { resolveWebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';

export {
  assertSafeWebsiteUrl,
  deduplicateUrls,
  isAllowedDomain,
  resolveRelativeUrl,
} from '@/features/aggregation/connectors/website/security';

export {
  WebsiteFetchLayer,
  WebsiteFetchError,
  websiteFetchLayer,
} from '@/features/aggregation/connectors/website/fetch';

export { detectWebsiteDocument } from '@/features/aggregation/connectors/website/detection';
export { selectWebsiteStrategy, getWebsiteStrategy, WEBSITE_STRATEGIES } from '@/features/aggregation/connectors/website/strategy-selector';
export { WebsiteProcessor, websiteProcessor } from '@/features/aggregation/connectors/website/processor';
export { mapRawWebsiteEvents, mapRawWebsiteEventToImportedEvent } from '@/features/aggregation/connectors/website/mapper';
