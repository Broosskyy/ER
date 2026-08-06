export const TICKET_PLATFORM_IDS = ['ticket_io', 'ticket_king'] as const;

export type TicketPlatformId = (typeof TICKET_PLATFORM_IDS)[number];

export function isTicketPlatformId(value: string): value is TicketPlatformId {
  return (TICKET_PLATFORM_IDS as readonly string[]).includes(value);
}

export type TicketPlatformConnectorConfig = TicketPlatformSourceConfig;

export interface TicketPlatformSourceConfig {
  platform: TicketPlatformId;
  shopSlug: string;
  listUrl?: string;
  userAgent?: string;
  timezone?: string;
  limits?: {
    maxEventsPerRun?: number;
    requestsPerMinute?: number;
    maxDetailPages?: number;
  };
  scope?: TicketPlatformScopeConfig;
}

export interface TicketPlatformScopeConfig {
  /** Known electronic clubs/venues (normalized lowercase). */
  allowedVenues?: string[];
  /** Known electronic organizers (normalized lowercase). */
  allowedOrganizers?: string[];
  /** Require at least one electronic signal; default true. */
  requireElectronicSignal?: boolean;
}

export interface TicketPlatformScopeStats {
  discovered: number;
  accepted: number;
  rejected: number;
  uncertain?: number;
  rejectionReasons: Record<string, number>;
}

export interface ParsedTicketPlatformEvent {
  externalId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  timezone: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  organizerName?: string;
  artistNames?: string[];
  genreNames?: string[];
  floorCount?: number;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
  minimumAge?: string;
  doorsOpenAt?: string;
  eventAttributes?: Array<{
    key: string;
    label: string;
    value?: string | number | boolean;
    source: string;
    confidence: number;
  }>;
  imageUrl?: string;
  ticketUrl: string;
  eventUrl: string;
  priceAmount?: number;
  priceCurrency?: string;
  /** Consumer-facing price label, e.g. "ab 12,00 €". */
  priceText?: string;
  /** schema.org Offer.availability or EventStatus when present. */
  availability?: string;
  soldOut?: boolean;
  cancelled?: boolean;
  /** Stable ticket.io event slug from shop path. */
  eventSlug?: string;
  /** Structured lineup entries with provenance. */
  lineupEntries?: Array<{
    displayName: string;
    normalizedName: string;
    role?: string;
    headliner?: boolean;
    isB2b?: boolean;
    isF2f?: boolean;
    isLiveSet?: boolean;
    stageOrFloor?: string;
    source: string;
    confidence: number;
    sortOrder?: number;
  }>;
  /** Structured ticket offers when available. */
  ticketOffers?: Array<{
    name: string;
    priceAmount?: number;
    priceCurrency?: string;
    availability?: string;
    soldOut?: boolean;
    purchaseUrl?: string;
    validFrom?: string;
    validUntil?: string;
  }>;
  /** Stable content hash for incremental sync. */
  normalizedHash?: string;
  /** Tri-state electronic music classification for Phase 4 corpus expansion. */
  electronicRelevance?: 'relevant' | 'irrelevant' | 'uncertain';
  /** Night Manager checkout widget id (Ticket Kings detail pages). */
  checkoutProviderId?: string;
  platform: TicketPlatformId;
  shopSlug: string;
}
