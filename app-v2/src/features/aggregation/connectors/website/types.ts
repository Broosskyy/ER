export const WEBSITE_STRATEGY_KEYS = [
  'json_ld',
  'embedded_json',
  'html_selector',
  'event_detail_page',
  'custom_adapter',
] as const;

export type WebsiteStrategyKey = (typeof WEBSITE_STRATEGY_KEYS)[number];

export const WEBSITE_DETECTED_FORMATS = [
  'json_ld',
  'schema_org_event',
  'embedded_json',
  'next_data',
  'nuxt_payload',
  'rss_link',
  'ical_link',
  'event_list',
  'event_card',
  'event_detail_link',
  'pagination_hint',
  'load_more_hint',
  'structured_date',
  'structured_venue',
  'ticket_link',
  'lineup_hint',
  'image_source',
  'client_rendered_suspected',
] as const;

export type WebsiteDetectedFormat = (typeof WEBSITE_DETECTED_FORMATS)[number];

export interface WebsiteFieldEvidence {
  field: string;
  strategy: WebsiteStrategyKey;
  sourceUrl: string;
  selectorOrPath?: string;
  confidence: number;
  extractedAt: string;
  rawValue?: string;
}

export interface RawWebsiteEvent {
  sourceUrl: string;
  detailUrl?: string;
  externalId: string;
  title?: string;
  rawStartDate?: string;
  rawEndDate?: string;
  rawVenue?: string;
  rawLocation?: string;
  rawDescription?: string;
  rawArtists?: string[];
  rawGenres?: string[];
  rawImages?: string[];
  rawTicketLinks?: string[];
  rawOrganizer?: string;
  rawStatus?: string;
  extractionStrategy: WebsiteStrategyKey;
  extractionConfidence: number;
  fieldEvidence: WebsiteFieldEvidence[];
  warnings: string[];
  /** Raw official detail page HTML when list-detail enrichment fetched a detail page. */
  officialDetailHtml?: string;
}

export interface WebsiteDetectedSignal {
  format: WebsiteDetectedFormat;
  confidence: number;
  count?: number;
  metadata?: Record<string, unknown>;
}

export interface WebsiteDetectionBlocker {
  code: string;
  message: string;
}

export interface WebsiteDetectionReport {
  requestedUrl: string;
  finalUrl: string;
  detectedStrategies: Array<{ key: WebsiteStrategyKey; confidence: number; eventCountEstimate: number }>;
  detectedFormats: WebsiteDetectedSignal[];
  eventContainerCount: number;
  detailPageUrls: string[];
  paginationDetected: boolean;
  ticketLinks: string[];
  imageSources: string[];
  dateFieldCount: number;
  venueFieldCount: number;
  javascriptRenderingSuspected: boolean;
  warnings: string[];
  blockers: WebsiteDetectionBlocker[];
  recommendedStrategy: WebsiteStrategyKey;
  recommendedNextAction: 'extract' | 'configure_selectors' | 'fetch_details' | 'blocked';
}

export interface WebsiteExtractionDiagnostics {
  fetchDurationMs: number;
  responseSize: number;
  redirectCount: number;
  detectionDurationMs: number;
  extractionDurationMs: number;
  strategy: WebsiteStrategyKey;
  confidence: number;
  candidateCount: number;
  validEventCount: number;
  skippedCount: number;
  detailPagesFetched: number;
  paginationPagesFetched: number;
  warnings: string[];
}

export interface WebsiteExtractionResult {
  events: RawWebsiteEvent[];
  detection: WebsiteDetectionReport;
  diagnostics: WebsiteExtractionDiagnostics;
}

export interface WebsiteDocument {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  charset?: string;
  html: string;
  responseSize: number;
  fetchedAt: string;
  redirectChain: string[];
  headers: Record<string, string>;
  detectedSignals: WebsiteDetectedSignal[];
  warnings: string[];
}
