import type { RunningOrderEntry, SourcedEventAttribute, TimetableSlotEntry } from '@/features/aggregation/domain/event-structured-detail';
import type { RawSourceType } from '@/features/import/models/normalized-event-candidate';

/**
 * Source-agnostic connector output contract (Phase 4.6.6 §2B).
 *
 * Every connector adapter must map extracted data into this shape before the
 * shared normalize → match → merge → publish pipeline. Provider-specific parsing
 * stays inside adapters only.
 */
export interface ConnectorFieldProvenance {
  field: string;
  strategy: string;
  sourceUrl?: string;
  selectorOrPath?: string;
  confidence: number;
  extractedAt?: string;
  rawValue?: string;
}

export interface ConnectorStructuredArtist {
  displayName: string;
  normalizedName?: string;
  role?: string;
  stageOrFloor?: string;
  sortOrder?: number;
  source: string;
  confidence: number;
}

export interface ConnectorTicketPhase {
  name: string;
  priceAmount?: number;
  priceCurrency?: string;
  priceText?: string;
  availability?: string;
  soldOut?: boolean;
  purchaseUrl?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface ConnectorNormalizedOutput {
  externalId: string;
  importId?: string;
  sourceUrl?: string;
  originalLink?: string;

  title?: string;
  subtitle?: string;
  description?: string;

  lineup?: string[];
  structuredArtists?: ConnectorStructuredArtist[];
  runningOrder?: RunningOrderEntry[];
  timetable?: TimetableSlotEntry[];

  genreNames?: string[];
  badges?: SourcedEventAttribute[];
  eventAttributes?: SourcedEventAttribute[];

  organizerName?: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;

  imageUrl?: string;
  imageUrls?: string[];

  ticketUrl?: string;
  eventUrl?: string;
  ticketStatus?: string;
  ticketPhases?: ConnectorTicketPhase[];
  priceAmount?: number;
  priceCurrency?: string;
  priceText?: string;

  minimumAge?: number | string;
  doorsOpenAt?: string;
  openingTime?: string;

  startDate?: string;
  endDate?: string;
  timezone?: string;
  isAllDay?: boolean;
  cancelled?: boolean;

  rawSourceType?: RawSourceType;
  extractionStrategy?: string;
  extractionConfidence?: number;
  provenance?: ConnectorFieldProvenance[];
  warnings?: string[];
  sourceMetadata?: Record<string, unknown>;
}

export const CONNECTOR_NORMALIZED_FIELD_KEYS = [
  'title',
  'subtitle',
  'description',
  'lineup',
  'structuredArtists',
  'runningOrder',
  'timetable',
  'genreNames',
  'badges',
  'eventAttributes',
  'organizerName',
  'venueName',
  'venueAddress',
  'cityName',
  'coordinates',
  'images',
  'ticketUrl',
  'ticketStatus',
  'ticketPhases',
  'priceText',
  'minimumAge',
  'doorsOpenAt',
  'openingTime',
  'provenance',
  'confidence',
  'extractionStrategy',
] as const;

export type ConnectorNormalizedFieldKey = (typeof CONNECTOR_NORMALIZED_FIELD_KEYS)[number];
