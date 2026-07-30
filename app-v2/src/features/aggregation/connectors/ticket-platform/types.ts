export const TICKET_PLATFORM_IDS = ['ticket_io', 'ticket_king'] as const;

export type TicketPlatformId = (typeof TICKET_PLATFORM_IDS)[number];

export function isTicketPlatformId(value: string): value is TicketPlatformId {
  return (TICKET_PLATFORM_IDS as readonly string[]).includes(value);
}

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
  imageUrl?: string;
  ticketUrl: string;
  eventUrl: string;
  priceAmount?: number;
  priceCurrency?: string;
  /** Night Manager checkout widget id (Ticket Kings detail pages). */
  checkoutProviderId?: string;
  platform: TicketPlatformId;
  shopSlug: string;
}
