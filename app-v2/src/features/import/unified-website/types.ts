import type { ExtractionDiagnostic } from '@/features/import/contracts/unified-import-result';

import type { DescriptionBoundaryResult } from './description-boundaries';
import type { LineupExtractionResult } from './lineup-extraction';
import type { TitleNormalizationResult } from './title-normalization';
import type { VenueEvidenceCandidate } from './venue-evidence';

export const UNIFIED_WEBSITE_IMPORTER_VERSION = 'phase4841-unified-website-v1';

export type DescriptionBodySource =
  | 'event_description_content'
  | 'event_body_ecm'
  | 'json_ld'
  | 'og_meta'
  | 'meta_description'
  | 'none';

export type TicketExtractionStrategy =
  | 'html_ticket_cta'
  | 'json_ld_offer'
  | 'structured_embed'
  | 'none';

export interface DescriptionExtractionResult {
  description?: string;
  source: DescriptionBodySource;
  rejectedShortMeta?: string;
  contaminationRejected: boolean;
  boilerplateStripped: boolean;
  boundaries?: DescriptionBoundaryResult;
}

export interface TitleExtractionResult extends TitleNormalizationResult {}

export interface TicketExtractionResult {
  url?: string;
  strategy: TicketExtractionStrategy;
  rejectedPromotional?: string[];
}

export interface DetailPageExtraction {
  title?: TitleExtractionResult;
  subtitle?: string;
  description?: DescriptionExtractionResult;
  genres?: string[];
  flyerUrl?: string;
  galleryUrls?: string[];
  startDate?: string;
  endDate?: string;
  venue?: VenueEvidenceCandidate;
  venueAddress?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  organizerName?: string;
  ticket?: TicketExtractionResult;
  lineup?: LineupExtractionResult;
  officialEventUrl?: string;
  diagnostics: ExtractionDiagnostic[];
}

export interface ListDiscoveryResult {
  listPageUrl: string;
  discoveredUrls: string[];
  strategy: string;
  diagnostics: ExtractionDiagnostic[];
}

export interface WebsiteProviderAdapter {
  key: string;
  hostPattern: RegExp;
  titleSuffixPatterns?: RegExp[];
  listDiscovery?: {
    listPageUrl: string;
    eventLinkPattern: RegExp;
    strategy: string;
  };
  extractGenres?: (html: string) => string[] | undefined;
  extractGallery?: (html: string, primaryImage?: string) => string[] | undefined;
  resolveOrganizerLabel?: (url: string) => string | undefined;
  resolvePromoterLabel?: (url: string) => string | undefined;
  /** Explicit venue proof on page (outside footer/description boilerplate). */
  extractExplicitVenueProof?: (html: string) => string | undefined;
  /** When true, provider default venue may be emitted as low-confidence candidate. */
  allowProviderDefaultVenue?: (html: string) => boolean;
  providerDefaultVenueLabel?: string;
  sourceRoles?: string[];
}

export interface UnifiedWebsiteImportContext {
  sourceId: string;
  sourceName: string;
  eventId: string;
  websiteUrl: string;
  verifiedTicketUrl?: string;
}
